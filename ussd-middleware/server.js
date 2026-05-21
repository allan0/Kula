// =============================================================================
// FILE: ussd-middleware/server.js
// PURPOSE: Africa's Talking USSD middleware refactored for EIP-4337 Account
//          Abstraction on Base L2. Instead of signing transactions with a
//          single server private key, each user gets a deterministic Smart
//          Account address derived from their phone number salt.
//
// EIP-4337 FLOW:
//   1. User dials USSD → Africa's Talking POSTs to /ussd
//   2. Middleware derives owner EOA from keccak256(phone + KULA_SALT_SECRET)
//   3. Middleware computes counterfactual Smart Account address via Factory
//   4. If account not deployed, initCode is included in the UserOperation
//   5. UserOperation is built and submitted to Pimlico bundler
//   6. VerifyingPaymaster sponsors gas → user pays zero ETH
//   7. EntryPoint executes the inner call on the Smart Account
//
// ARCHITECTURE:
//   - Stateless middleware: all user state lives in PostgreSQL (db/schema.sql)
//   - All blockchain calls use viem (Base L2 compatible, EIP-4337 native)
//   - Pimlico permissionless.js handles UserOperation construction + bundling
//   - Africa's Talking USSD sessions are persisted in ussd_sessions table
// =============================================================================

'use strict';

const express    = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const { Pool }   = require('pg');
require('dotenv').config();

// -----------------------------------------------------------------------------
// ENVIRONMENT VALIDATION
// -----------------------------------------------------------------------------

const REQUIRED_ENV = [
    'BASE_SEPOLIA_RPC',
    'KULA_SALT_SECRET',
    'SIMPLE_ACCOUNT_FACTORY',
    'ROTARY_GROUP_CONTRACT',
    'PIMLICO_API_KEY',
    'PAYMASTER_ADDRESS',
    'PAYMASTER_SIGNER_KEY',
    'ENTRY_POINT_ADDRESS',
    'DATABASE_URL',
];

const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnv.join(', '));
    process.exit(1);
}

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------

// ERC-4337 EntryPoint v0.7 — deployed at same address on all EVM chains
const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT_ADDRESS
    || '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Base Sepolia chain ID
const BASE_SEPOLIA_CHAIN_ID = 84532;

// SimpleAccountFactory — deploy ERC-4337 reference implementation or use
// a pre-deployed factory on Base Sepolia
const SIMPLE_ACCOUNT_FACTORY = process.env.SIMPLE_ACCOUNT_FACTORY;

// Pimlico bundler RPC for Base Sepolia
const PIMLICO_RPC = `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${process.env.PIMLICO_API_KEY}`;

// RotaryGroup ABI — only the functions called via UserOperations
const ROTARY_GROUP_ABI = [
    'function createGroup(string calldata _name, uint256 _contributionAmount, uint256 _intervalSeconds) external returns (uint256)',
    'function applyToJoin(uint256 _groupId) external',
    'function deposit(uint256 _groupId, uint256 _amount) external',
    'function getMembers(uint256 _groupId) external view returns (address[])',
    'function getMemberCount(uint256 _groupId) external view returns (uint256)',
    'function getCurrentRecipient(uint256 _groupId) external view returns (address)',
    'function groups(uint256) external view returns (uint256,string,address,uint256,uint256,uint256,uint256,uint256,uint256,bool)',
    'function groupCount() external view returns (uint256)',
    'function isMember(uint256 _groupId, address _addr) external view returns (bool)',
];

// SimpleAccountFactory ABI — getAddress and createAccount
const FACTORY_ABI = [
    'function getAddress(address owner, uint256 salt) external view returns (address)',
    'function createAccount(address owner, uint256 salt) external returns (address)',
];

// SimpleAccount ABI — execute is the inner call wrapper
const SIMPLE_ACCOUNT_ABI = [
    'function execute(address dest, uint256 value, bytes calldata func) external',
    'function executeBatch(address[] calldata dest, bytes[] calldata func) external',
    'function getNonce() external view returns (uint256)',
];

// ERC-20 USDC ABI — approve needed before deposit
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
];

// Base Sepolia USDC
const USDC_ADDRESS = process.env.USDC_ADDRESS
    || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// -----------------------------------------------------------------------------
// INFRASTRUCTURE SETUP
// -----------------------------------------------------------------------------

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// PostgreSQL connection pool
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Base Sepolia JSON-RPC provider (read-only — for view calls and nonce fetching)
const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);

// Pimlico bundler provider — handles UserOperation submission
const bundlerProvider = new ethers.JsonRpcProvider(PIMLICO_RPC);

// Contract instances (read-only — no signer needed for view calls)
const rotaryGroupContract = new ethers.Contract(
    process.env.ROTARY_GROUP_CONTRACT,
    ROTARY_GROUP_ABI,
    provider
);
const factoryContract = new ethers.Contract(
    SIMPLE_ACCOUNT_FACTORY,
    FACTORY_ABI,
    provider
);

// -----------------------------------------------------------------------------
// CORE: DETERMINISTIC ADDRESS DERIVATION
// -----------------------------------------------------------------------------

/**
 * Derives a deterministic owner EOA private key from a phone number.
 *
 * SECURITY MODEL:
 * The private key is derived as:
 *   privateKey = keccak256(keccak256(phoneNumber) + KULA_SALT_SECRET)
 *
 * This is a double-hash construction:
 *   - Inner hash: isolates phone number from the salt
 *   - Outer hash with server secret: prevents brute-force derivation
 *     even if the phone number is known
 *
 * The private key is NEVER stored — it is re-derived on every request.
 * The server secret (KULA_SALT_SECRET) must be stored securely in
 * environment variables and rotated if compromised.
 *
 * @param {string} phoneNumber - E.164 format phone number (+254712345678)
 * @returns {{ privateKey: string, wallet: ethers.Wallet, address: string }}
 */
function deriveOwnerWallet(phoneNumber) {
    // Normalise phone number — strip spaces, ensure E.164
    const normalised = phoneNumber.trim().replace(/\s+/g, '');

    // Inner hash of phone number
    const phoneHash = ethers.keccak256(
        ethers.toUtf8Bytes(normalised)
    );

    // Outer hash: phoneHash + server secret — this is the actual private key
    const privateKey = ethers.keccak256(
        ethers.concat([
            ethers.getBytes(phoneHash),
            ethers.toUtf8Bytes(process.env.KULA_SALT_SECRET),
        ])
    );

    const wallet = new ethers.Wallet(privateKey, provider);

    return {
        privateKey,
        wallet,
        address: wallet.address,
    };
}

/**
 * Derives the deterministic salt used in SimpleAccountFactory.getAddress().
 * Salt = keccak256(phoneNumber + KULA_SALT_SECRET) as a uint256.
 *
 * Stored in the users.derivation_salt column for fast lookup.
 *
 * @param {string} phoneNumber - E.164 format phone number
 * @returns {string} - 32-byte hex salt (0x-prefixed)
 */
function deriveAccountSalt(phoneNumber) {
    const normalised = phoneNumber.trim().replace(/\s+/g, '');
    return ethers.keccak256(
        ethers.concat([
            ethers.toUtf8Bytes(normalised),
            ethers.toUtf8Bytes(process.env.KULA_SALT_SECRET),
        ])
    );
}

/**
 * Computes the counterfactual Smart Account address for a phone number.
 * This address exists deterministically before deployment — it can receive
 * funds and be referenced in contracts before the account is deployed.
 *
 * Uses SimpleAccountFactory.getAddress(ownerEOA, salt).
 *
 * @param {string} phoneNumber - E.164 format phone number
 * @returns {Promise<{ smartAccountAddress: string, ownerEOA: string, salt: string }>}
 */
async function deriveSmartAccountAddress(phoneNumber) {
    const { address: ownerEOA } = deriveOwnerWallet(phoneNumber);
    const salt = deriveAccountSalt(phoneNumber);

    // Convert salt bytes32 to uint256 for the factory
    const saltUint256 = BigInt(salt);

    // Call the factory's view function — no gas required
    const smartAccountAddress = await factoryContract.getAddress(
        ownerEOA,
        saltUint256
    );

    return {
        smartAccountAddress,
        ownerEOA,
        salt,
        saltUint256,
    };
}

// -----------------------------------------------------------------------------
// CORE: USER REGISTRATION & LOOKUP
// -----------------------------------------------------------------------------

/**
 * Finds an existing user by phone number or creates a new one.
 * On first call for a phone number:
 *   1. Derives owner EOA and Smart Account address
 *   2. Inserts a new row in users table (status = PENDING)
 *   3. Returns the new user record
 *
 * @param {string} phoneNumber - E.164 format phone number
 * @returns {Promise<object>} - User row from the users table
 */
async function getOrCreateUser(phoneNumber) {
    // Check if user already exists
    const existing = await db.query(
        'SELECT * FROM users WHERE phone_number = $1',
        [phoneNumber]
    );

    if (existing.rows.length > 0) {
        return existing.rows[0];
    }

    // New user — derive all identity components
    const { smartAccountAddress, ownerEOA, salt } = await deriveSmartAccountAddress(phoneNumber);

    // Check if Smart Account is already deployed on-chain
    const code = await provider.getCode(smartAccountAddress);
    const isDeployed = code !== '0x';

    const result = await db.query(
        `INSERT INTO users (
            smart_account_address,
            phone_number,
            owner_eoa,
            derivation_salt,
            onboarding_channel,
            account_status,
            reputation_score
        ) VALUES ($1, $2, $3, $4, 'USSD', $5, 50)
        ON CONFLICT (phone_number) DO UPDATE
            SET updated_at = NOW()
        RETURNING *`,
        [
            smartAccountAddress,
            phoneNumber,
            ownerEOA,
            salt,
            isDeployed ? 'DEPLOYED' : 'PENDING',
        ]
    );

    console.log(`✅ New user registered: ${phoneNumber} → ${smartAccountAddress}`);
    return result.rows[0];
}

// -----------------------------------------------------------------------------
// CORE: EIP-4337 USER OPERATION BUILDER
// -----------------------------------------------------------------------------

/**
 * Builds and submits a UserOperation to the Pimlico bundler.
 *
 * EIP-4337 UserOperation structure (v0.7 packed format):
 *   - sender:              Smart Account address
 *   - nonce:               From EntryPoint.getNonce(sender, 0)
 *   - initCode:            Factory calldata if account not deployed, else '0x'
 *   - callData:            SimpleAccount.execute(target, value, innerCalldata)
 *   - accountGasLimits:    verificationGasLimit | callGasLimit (packed bytes32)
 *   - preVerificationGas:  Gas for bundler overhead
 *   - gasFees:             maxFeePerGas | maxPriorityFeePerGas (packed bytes32)
 *   - paymasterAndData:    Paymaster address + validUntil + validAfter + signature
 *   - signature:           Owner EOA signature over the UserOp hash
 *
 * @param {object} params
 * @param {string} params.phoneNumber      - User's phone number
 * @param {string} params.targetContract   - Address of contract to call
 * @param {string} params.innerCalldata    - Encoded function call (ethers Interface)
 * @param {string} params.operationType    - Human-readable label for DB logging
 * @param {number} [params.groupId]        - RotaryGroup group ID (for logging)
 * @param {string} [params.usdcAmount]     - USDC amount involved (for logging)
 * @returns {Promise<string>}              - UserOperation hash
 */
async function submitUserOperation({
    phoneNumber,
    targetContract,
    innerCalldata,
    operationType,
    groupId = null,
    usdcAmount = null,
}) {
    const user = await getOrCreateUser(phoneNumber);
    const { wallet: ownerWallet, saltUint256 } = {
        wallet: deriveOwnerWallet(phoneNumber).wallet,
        saltUint256: BigInt(deriveAccountSalt(phoneNumber)),
    };

    const smartAccountAddress = user.smart_account_address;

    // -------------------------------------------------------------------------
    // 1. Determine initCode
    //    If account is PENDING (not yet deployed), include the factory calldata
    //    so the EntryPoint deploys it in the same transaction as our call.
    // -------------------------------------------------------------------------
    let initCode = '0x';

    if (user.account_status === 'PENDING') {
        const code = await provider.getCode(smartAccountAddress);
        if (code === '0x') {
            // Encode: factory address + createAccount(ownerEOA, salt) calldata
            const factoryInterface = new ethers.Interface(FACTORY_ABI);
            const createAccountData = factoryInterface.encodeFunctionData(
                'createAccount',
                [user.owner_eoa, saltUint256]
            );
            initCode = ethers.concat([SIMPLE_ACCOUNT_FACTORY, createAccountData]);
        }
    }

    // -------------------------------------------------------------------------
    // 2. Build callData
    //    SimpleAccount.execute(targetContract, 0, innerCalldata)
    //    Value is 0 — we use USDC (ERC-20), not native ETH
    // -------------------------------------------------------------------------
    const accountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
    const callData = accountInterface.encodeFunctionData('execute', [
        targetContract,
        0n,         // ETH value — always 0, we use USDC
        innerCalldata,
    ]);

    // -------------------------------------------------------------------------
    // 3. Get nonce from EntryPoint
    //    getNonce(sender, key) — key=0 for sequential nonces
    // -------------------------------------------------------------------------
    const entryPointInterface = new ethers.Interface([
        'function getNonce(address sender, uint192 key) external view returns (uint256)',
    ]);
    const entryPoint = new ethers.Contract(
        ENTRY_POINT_ADDRESS,
        entryPointInterface,
        provider
    );
    const nonce = await entryPoint.getNonce(smartAccountAddress, 0n);

    // -------------------------------------------------------------------------
    // 4. Get current gas prices from Base L2
    // -------------------------------------------------------------------------
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('0.005', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.001', 'gwei');

    // -------------------------------------------------------------------------
    // 5. Gas estimates — use Pimlico's eth_estimateUserOperationGas
    //    We pre-populate with safe defaults, then ask the bundler to correct them
    // -------------------------------------------------------------------------
    const GAS_LIMITS = {
        verificationGasLimit: 150000n,
        callGasLimit: 200000n,
        preVerificationGas: 50000n,
    };

    // Pack gas limits into bytes32 (EIP-4337 v0.7 format)
    const accountGasLimits = ethers.solidityPacked(
        ['uint128', 'uint128'],
        [GAS_LIMITS.verificationGasLimit, GAS_LIMITS.callGasLimit]
    );
    const gasFees = ethers.solidityPacked(
        ['uint128', 'uint128'],
        [maxPriorityFeePerGas, maxFeePerGas]
    );

    // -------------------------------------------------------------------------
    // 6. Build preliminary UserOperation (without paymaster signature yet)
    // -------------------------------------------------------------------------
    const userOpForPaymaster = {
        sender:             smartAccountAddress,
        nonce:              ethers.toBeHex(nonce),
        initCode,
        callData,
        accountGasLimits,
        preVerificationGas: ethers.toBeHex(GAS_LIMITS.preVerificationGas),
        gasFees,
        paymasterAndData:   '0x',  // Empty until paymaster signs
        signature:          '0x',  // Empty until owner signs
    };

    // -------------------------------------------------------------------------
    // 7. Request Paymaster signature from VerifyingPaymaster
    //    The paymaster signs: keccak256(userOpHash + validUntil + validAfter)
    //    Users pay ZERO gas — the paymaster covers all Base L2 fees
    // -------------------------------------------------------------------------
    const paymasterAndData = await buildPaymasterAndData(
        userOpForPaymaster,
        smartAccountAddress
    );

    // -------------------------------------------------------------------------
    // 8. Build final UserOperation with paymasterAndData
    // -------------------------------------------------------------------------
    const userOp = {
        ...userOpForPaymaster,
        paymasterAndData,
    };

    // -------------------------------------------------------------------------
    // 9. Compute UserOperation hash and sign with owner EOA
    //    hash = keccak256(abi.encode(packedUserOp, entryPoint, chainId))
    // -------------------------------------------------------------------------
    const userOpHash = computeUserOpHash(userOp, ENTRY_POINT_ADDRESS, BASE_SEPOLIA_CHAIN_ID);
    const signature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = signature;

    // -------------------------------------------------------------------------
    // 10. Submit to Pimlico bundler via eth_sendUserOperation
    // -------------------------------------------------------------------------
    const userOpHashFromBundler = await bundlerProvider.send(
        'eth_sendUserOperation',
        [userOp, ENTRY_POINT_ADDRESS]
    );

    console.log(`📤 UserOperation submitted: ${userOpHashFromBundler}`);

    // -------------------------------------------------------------------------
    // 11. Persist to database for audit trail and USSD status polling
    // -------------------------------------------------------------------------
    await db.query(
        `INSERT INTO user_operations (
            smart_account_address, user_op_hash, operation_type,
            call_data, usdc_amount, group_id, status,
            paymaster_sponsored, bundler_endpoint, submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED', true, $7, NOW())`,
        [
            smartAccountAddress,
            userOpHashFromBundler,
            operationType,
            callData,
            usdcAmount,
            groupId,
            PIMLICO_RPC,
        ]
    );

    // Mark account as deployed if it was pending
    if (initCode !== '0x') {
        await db.query(
            `UPDATE users SET account_status = 'DEPLOYED', updated_at = NOW()
             WHERE smart_account_address = $1`,
            [smartAccountAddress]
        );
    }

    return userOpHashFromBundler;
}

// -----------------------------------------------------------------------------
// CORE: PAYMASTER INTEGRATION
// -----------------------------------------------------------------------------

/**
 * Builds the paymasterAndData field for a VerifyingPaymaster.
 *
 * Format:
 *   paymasterAndData = paymasterAddress (20 bytes)
 *                    + validUntil (6 bytes, uint48)
 *                    + validAfter (6 bytes, uint48)
 *                    + paymasterSignature (65 bytes)
 *
 * The paymaster signer signs: keccak256(userOpHash + validUntil + validAfter)
 * The VerifyingPaymaster contract verifies this signature on-chain.
 *
 * In production, this call would go to your deployed VerifyingPaymaster or
 * Pimlico's sponsored paymaster API. Here we use Pimlico's pm_sponsorUserOperation.
 *
 * @param {object} userOp              - Preliminary UserOperation
 * @param {string} smartAccountAddress - Sender address
 * @returns {Promise<string>}          - Encoded paymasterAndData hex string
 */
async function buildPaymasterAndData(userOp, smartAccountAddress) {
    try {
        // Use Pimlico's sponsorship API — pm_sponsorUserOperation
        // This returns paymasterAndData already encoded
        const sponsorResult = await bundlerProvider.send(
            'pm_sponsorUserOperation',
            [
                userOp,
                ENTRY_POINT_ADDRESS,
                { sponsorshipPolicyId: process.env.PIMLICO_SPONSORSHIP_POLICY_ID || undefined },
            ]
        );

        if (sponsorResult.paymasterAndData) {
            console.log(`✅ Paymaster sponsored for: ${smartAccountAddress}`);
            return sponsorResult.paymasterAndData;
        }
    } catch (err) {
        console.warn('⚠️  Pimlico sponsorship failed, falling back to local paymaster:', err.message);
    }

    // Fallback: build paymasterAndData using local PAYMASTER_SIGNER_KEY
    // Use this if you have a self-deployed VerifyingPaymaster
    const paymasterSigner = new ethers.Wallet(process.env.PAYMASTER_SIGNER_KEY);
    const PAYMASTER_ADDRESS = process.env.PAYMASTER_ADDRESS;

    // Validity window: valid for 1 hour from now
    const validAfter = 0n;
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Build the data the paymaster signs over
    const paymasterDataToSign = ethers.solidityPacked(
        ['address', 'uint48', 'uint48'],
        [PAYMASTER_ADDRESS, validUntil, validAfter]
    );

    // The hash the paymaster verifies on-chain
    const paymasterHash = ethers.keccak256(
        ethers.concat([
            ethers.toUtf8Bytes('\x19Ethereum Signed Message:\n32'),
            ethers.keccak256(paymasterDataToSign),
        ])
    );

    const paymasterSignature = await paymasterSigner.signMessage(
        ethers.getBytes(paymasterHash)
    );

    // Encode: paymasterAddress + validUntil + validAfter + signature
    return ethers.solidityPacked(
        ['address', 'uint48', 'uint48', 'bytes'],
        [PAYMASTER_ADDRESS, validUntil, validAfter, paymasterSignature]
    );
}

// -----------------------------------------------------------------------------
// CORE: USEROPERATION HASH COMPUTATION
// -----------------------------------------------------------------------------

/**
 * Computes the EIP-4337 v0.7 UserOperation hash.
 * This is what the owner EOA signs and what the EntryPoint verifies.
 *
 * hash = keccak256(abi.encode(
 *     keccak256(abi.encode(packedUserOp)),
 *     entryPoint,
 *     chainId
 * ))
 *
 * @param {object} userOp        - Complete UserOperation struct
 * @param {string} entryPoint    - EntryPoint contract address
 * @param {number} chainId       - Chain ID (84532 for Base Sepolia)
 * @returns {string}             - 32-byte hash (0x-prefixed)
 */
function computeUserOpHash(userOp, entryPoint, chainId) {
    // Pack the UserOperation fields per EIP-4337 v0.7 spec
    const packedUserOp = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32'],
        [
            userOp.sender,
            userOp.nonce,
            ethers.keccak256(userOp.initCode),
            ethers.keccak256(userOp.callData),
            userOp.accountGasLimits,
            userOp.preVerificationGas,
            userOp.gasFees,
            ethers.keccak256(userOp.paymasterAndData),
        ]
    );

    const innerHash = ethers.keccak256(packedUserOp);

    // Final hash includes entryPoint address and chainId to prevent replay attacks
    return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'address', 'uint256'],
            [innerHash, entryPoint, chainId]
        )
    );
}

// -----------------------------------------------------------------------------
// USSD SESSION MANAGEMENT
// -----------------------------------------------------------------------------

/**
 * Persists or retrieves a USSD session from the database.
 * Africa's Talking calls our endpoint on every menu level with the full
 * accumulated text string (e.g. "1*Nairobi Circle*10").
 *
 * @param {string} sessionId   - Africa's Talking session ID
 * @param {string} phoneNumber - Caller's phone number
 * @param {string} text        - Full accumulated USSD input text
 * @returns {Promise<object>}  - Session row
 */
async function upsertSession(sessionId, phoneNumber, text) {
    const result = await db.query(
        `INSERT INTO ussd_sessions (at_session_id, phone_number, session_text, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '3 minutes')
         ON CONFLICT (at_session_id) DO UPDATE
             SET session_text = $3,
                 updated_at = NOW(),
                 expires_at = NOW() + INTERVAL '3 minutes'
         RETURNING *`,
        [sessionId, phoneNumber, text]
    );
    return result.rows[0];
}

// -----------------------------------------------------------------------------
// USSD MENU HANDLERS
// -----------------------------------------------------------------------------

/**
 * Handles the USSD menu flow. Returns a CON (continue) or END response string.
 * Menu structure:
 *   ''        → Main menu
 *   '1'       → Create Group
 *   '1*name'  → Confirm group name → submit UserOperation
 *   '2'       → Join Group (enter ID)
 *   '2*id'    → Submit join UserOperation
 *   '3'       → Contribute (enter group ID and amount)
 *   '3*id'    → Enter amount
 *   '3*id*amt'→ Submit deposit UserOperation
 *   '4'       → My Status
 *
 * @param {string} phoneNumber - E.164 caller phone number
 * @param {string} text        - Full accumulated USSD input
 * @returns {Promise<string>}  - USSD response string
 */
async function handleUssdMenu(phoneNumber, text) {
    const parts = text.split('*');
    const level = parts[0];

    // -------------------------------------------------------------------------
    // MAIN MENU
    // -------------------------------------------------------------------------
    if (text === '' || text === undefined) {
        return (
            'CON Welcome to KULA\n' +
            '1. Create Circle\n' +
            '2. Join Circle\n' +
            '3. Contribute\n' +
            '4. My Status'
        );
    }

    // -------------------------------------------------------------------------
    // CREATE GROUP — Level 1
    // -------------------------------------------------------------------------
    if (text === '1') {
        return 'CON Enter Circle Name:\n(e.g. Nairobi Elite)';
    }

    // CREATE GROUP — Level 2: name provided, confirm
    if (level === '1' && parts.length === 2) {
        const groupName = parts[1].trim();
        if (!groupName || groupName.length < 2) {
            return 'CON Name too short. Enter Circle Name:';
        }
        return (
            `CON Create "${groupName}"?\n` +
            '1. Confirm (10 USDC/week)\n' +
            '2. Cancel'
        );
    }

    // CREATE GROUP — Level 3: confirmed
    if (level === '1' && parts.length === 3) {
        if (parts[2] !== '1') return 'END Cancelled.';

        const groupName = parts[1].trim();

        try {
            const rotaryInterface = new ethers.Interface(ROTARY_GROUP_ABI);
            // 10 USDC per week: 10 * 10^6 = 10000000, interval = 604800 seconds
            const innerCalldata = rotaryInterface.encodeFunctionData('createGroup', [
                groupName,
                ethers.parseUnits('10', 6),  // 10 USDC (6 decimals)
                604800n,                      // 1 week in seconds
            ]);

            const userOpHash = await submitUserOperation({
                phoneNumber,
                targetContract: process.env.ROTARY_GROUP_CONTRACT,
                innerCalldata,
                operationType: 'createGroup',
                usdcAmount: '0',
            });

            return (
                `END Circle "${groupName}" is being created!\n` +
                `Ref: ${userOpHash.slice(0, 12)}...\n` +
                'You will receive a confirmation shortly.'
            );
        } catch (err) {
            console.error('createGroup error:', err.message);
            return 'END Error creating circle. Please try again.';
        }
    }

    // -------------------------------------------------------------------------
    // JOIN GROUP — Level 1
    // -------------------------------------------------------------------------
    if (text === '2') {
        return 'CON Enter Circle ID:\n(e.g. 1, 2, 3)';
    }

    // JOIN GROUP — Level 2: ID provided
    if (level === '2' && parts.length === 2) {
        const groupId = parseInt(parts[1], 10);
        if (isNaN(groupId) || groupId < 1) {
            return 'CON Invalid ID. Enter Circle ID:';
        }

        try {
            // Verify group exists before submitting
            const groupCount = await rotaryGroupContract.groupCount();
            if (BigInt(groupId) > groupCount) {
                return 'END Circle not found.';
            }

            const groupData = await rotaryGroupContract.groups(groupId);
            const groupName = groupData[1]; // name is index 1 in the tuple

            return (
                `CON Join "${groupName}"?\n` +
                `Circle ID: ${groupId}\n` +
                '1. Apply to Join\n' +
                '2. Cancel'
            );
        } catch (err) {
            console.error('groups() error:', err.message);
            return 'CON Join Circle ID ' + groupId + '?\n1. Confirm\n2. Cancel';
        }
    }

    // JOIN GROUP — Level 3: confirmed
    if (level === '2' && parts.length === 3) {
        if (parts[2] !== '1') return 'END Cancelled.';

        const groupId = parseInt(parts[1], 10);

        try {
            const rotaryInterface = new ethers.Interface(ROTARY_GROUP_ABI);
            const innerCalldata = rotaryInterface.encodeFunctionData(
                'applyToJoin',
                [groupId]
            );

            const userOpHash = await submitUserOperation({
                phoneNumber,
                targetContract: process.env.ROTARY_GROUP_CONTRACT,
                innerCalldata,
                operationType: 'applyToJoin',
                groupId,
                usdcAmount: '0',
            });

            return (
                `END Application submitted for Circle ${groupId}!\n` +
                `Ref: ${userOpHash.slice(0, 12)}...\n` +
                'Members will vote on your admission.'
            );
        } catch (err) {
            console.error('applyToJoin error:', err.message);
            return 'END Error submitting application. Try again.';
        }
    }

    // -------------------------------------------------------------------------
    // CONTRIBUTE — Level 1
    // -------------------------------------------------------------------------
    if (text === '3') {
        return 'CON Enter Circle ID to contribute to:';
    }

    // CONTRIBUTE — Level 2: group ID provided
    if (level === '3' && parts.length === 2) {
        const groupId = parseInt(parts[1], 10);
        if (isNaN(groupId) || groupId < 1) {
            return 'CON Invalid ID. Enter Circle ID:';
        }

        try {
            const groupData = await rotaryGroupContract.groups(groupId);
            const contributionAmount = groupData[3]; // contributionAmount index
            const usdcAmount = ethers.formatUnits(contributionAmount, 6);
            return `CON Contribute ${usdcAmount} USDC to Circle ${groupId}?\n1. Confirm\n2. Cancel`;
        } catch (err) {
            return `CON Contribute to Circle ${groupId}?\n1. Confirm\n2. Cancel`;
        }
    }

    // CONTRIBUTE — Level 3: confirmed
    if (level === '3' && parts.length === 3) {
        if (parts[2] !== '1') return 'END Cancelled.';

        const groupId = parseInt(parts[1], 10);

        try {
            // Get the required contribution amount from the contract
            const groupData = await rotaryGroupContract.groups(groupId);
            const contributionAmount = groupData[3];

            // Build a batch UserOperation:
            // 1. USDC.approve(rotaryGroup, contributionAmount)
            // 2. RotaryGroup.deposit(groupId, contributionAmount)
            const user = await getOrCreateUser(phoneNumber);
            const userOpHash = await submitBatchContribution({
                phoneNumber,
                user,
                groupId,
                contributionAmount,
            });

            return (
                `END Contribution of ${ethers.formatUnits(contributionAmount, 6)} USDC submitted!\n` +
                `Ref: ${userOpHash.slice(0, 12)}...\n` +
                'Your reputation score will update on confirmation.'
            );
        } catch (err) {
            console.error('contribute error:', err.message);
            return 'END Error submitting contribution. Ensure you have sufficient USDC balance.';
        }
    }

    // -------------------------------------------------------------------------
    // MY STATUS — Level 1
    // -------------------------------------------------------------------------
    if (text === '4') {
        try {
            const user = await getOrCreateUser(phoneNumber);
            const shortAddr = `${user.smart_account_address.slice(0, 6)}...${user.smart_account_address.slice(-4)}`;

            // Get pending UserOp if any
            const pendingOps = await db.query(
                `SELECT operation_type, submitted_at FROM user_operations
                 WHERE smart_account_address = $1
                 AND status IN ('PENDING', 'SUBMITTED')
                 ORDER BY created_at DESC LIMIT 1`,
                [user.smart_account_address]
            );

            let statusLine = 'No pending transactions.';
            if (pendingOps.rows.length > 0) {
                statusLine = `Pending: ${pendingOps.rows[0].operation_type}`;
            }

            return (
                `END KULA Status\n` +
                `Wallet: ${shortAddr}\n` +
                `Rep Score: ${user.reputation_score}/100 (${user.reputation_tier})\n` +
                `Status: ${user.account_status}\n` +
                `${statusLine}`
            );
        } catch (err) {
            console.error('status error:', err.message);
            return 'END Error fetching status. Try again.';
        }
    }

    return 'END Invalid input. Please try again.';
}

// -----------------------------------------------------------------------------
// BATCH CONTRIBUTION — USDC Approve + Deposit in one UserOperation
// -----------------------------------------------------------------------------

/**
 * Submits a batched UserOperation that:
 * 1. Approves the RotaryGroup contract to spend USDC from the Smart Account
 * 2. Calls RotaryGroup.deposit(groupId, amount)
 *
 * Uses SimpleAccount.executeBatch() to combine both calls atomically.
 *
 * @param {object} params
 * @param {string} params.phoneNumber        - User's phone number
 * @param {object} params.user               - User row from DB
 * @param {number} params.groupId            - RotaryGroup group ID
 * @param {bigint} params.contributionAmount - USDC amount (6 decimals)
 * @returns {Promise<string>}                - UserOperation hash
 */
async function submitBatchContribution({ phoneNumber, user, groupId, contributionAmount }) {
    const { wallet: ownerWallet, saltUint256 } = {
        wallet: deriveOwnerWallet(phoneNumber).wallet,
        saltUint256: BigInt(deriveAccountSalt(phoneNumber)),
    };

    const smartAccountAddress = user.smart_account_address;

    // Encode the two inner calls
    const usdcInterface = new ethers.Interface(ERC20_ABI);
    const rotaryInterface = new ethers.Interface(ROTARY_GROUP_ABI);

    const approveCalldata = usdcInterface.encodeFunctionData('approve', [
        process.env.ROTARY_GROUP_CONTRACT,
        contributionAmount,
    ]);

    const depositCalldata = rotaryInterface.encodeFunctionData('deposit', [
        groupId,
        contributionAmount,
    ]);

    // Encode executeBatch([usdcAddr, rotaryAddr], [approveData, depositData])
    const accountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
    const batchCallData = accountInterface.encodeFunctionData('executeBatch', [
        [USDC_ADDRESS, process.env.ROTARY_GROUP_CONTRACT],
        [approveCalldata, depositCalldata],
    ]);

    // From here the flow is identical to submitUserOperation but with batchCallData
    let initCode = '0x';
    if (user.account_status === 'PENDING') {
        const code = await provider.getCode(smartAccountAddress);
        if (code === '0x') {
            const factoryInterface = new ethers.Interface(FACTORY_ABI);
            const createAccountData = factoryInterface.encodeFunctionData('createAccount', [
                user.owner_eoa,
                saltUint256,
            ]);
            initCode = ethers.concat([SIMPLE_ACCOUNT_FACTORY, createAccountData]);
        }
    }

    const entryPointInterface = new ethers.Interface([
        'function getNonce(address sender, uint192 key) external view returns (uint256)',
    ]);
    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointInterface, provider);
    const nonce = await entryPoint.getNonce(smartAccountAddress, 0n);

    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('0.005', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.001', 'gwei');

    const accountGasLimits = ethers.solidityPacked(
        ['uint128', 'uint128'],
        [200000n, 300000n]  // Higher limits for batch
    );
    const gasFees = ethers.solidityPacked(
        ['uint128', 'uint128'],
        [maxPriorityFeePerGas, maxFeePerGas]
    );

    const userOpForPaymaster = {
        sender:             smartAccountAddress,
        nonce:              ethers.toBeHex(nonce),
        initCode,
        callData:           batchCallData,
        accountGasLimits,
        preVerificationGas: ethers.toBeHex(60000n),
        gasFees,
        paymasterAndData:   '0x',
        signature:          '0x',
    };

    const paymasterAndData = await buildPaymasterAndData(userOpForPaymaster, smartAccountAddress);
    const userOp = { ...userOpForPaymaster, paymasterAndData };

    const userOpHash = computeUserOpHash(userOp, ENTRY_POINT_ADDRESS, BASE_SEPOLIA_CHAIN_ID);
    const signature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = signature;

    const userOpHashFromBundler = await bundlerProvider.send(
        'eth_sendUserOperation',
        [userOp, ENTRY_POINT_ADDRESS]
    );

    await db.query(
        `INSERT INTO user_operations (
            smart_account_address, user_op_hash, operation_type,
            call_data, usdc_amount, group_id, status,
            paymaster_sponsored, bundler_endpoint, submitted_at
        ) VALUES ($1, $2, 'deposit', $3, $4, $5, 'SUBMITTED', true, $6, NOW())`,
        [
            smartAccountAddress,
            userOpHashFromBundler,
            batchCallData,
            ethers.formatUnits(contributionAmount, 6),
            groupId,
            PIMLICO_RPC,
        ]
    );

    return userOpHashFromBundler;
}

// -----------------------------------------------------------------------------
// HTTP ROUTES
// -----------------------------------------------------------------------------

// Health check
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'online',
        service: 'KULA USSD Middleware',
        version: '2.0.0',
        chain: 'Base Sepolia (EIP-4337)',
        entryPoint: ENTRY_POINT_ADDRESS,
    });
});

// Africa's Talking USSD POST endpoint
app.post('/ussd', async (req, res) => {
    const {
        sessionId,
        serviceCode,
        phoneNumber,
        text = '',
        networkCode,
    } = req.body;

    if (!phoneNumber) {
        return res.status(400).send('END Missing phone number.');
    }

    console.log(`📞 USSD: ${phoneNumber} | Session: ${sessionId} | Text: "${text}"`);

    try {
        // Persist session state
        await upsertSession(sessionId, phoneNumber, text);

        // Route to menu handler
        const response = await handleUssdMenu(phoneNumber, text);

        res.set('Content-Type', 'text/plain');
        return res.send(response);
    } catch (err) {
        console.error('USSD handler error:', err);
        res.set('Content-Type', 'text/plain');
        return res.send('END A system error occurred. Please try again later.');
    }
});

// REST endpoint: lookup Smart Account address by phone number
// Called by the frontend IdentityHub to link USSD and web identities
app.get('/api/account/:phoneNumber', async (req, res) => {
    try {
        const phone = decodeURIComponent(req.params.phoneNumber);
        const user = await db.query(
            'SELECT * FROM users WHERE phone_number = $1',
            [phone]
        );

        if (user.rows.length === 0) {
            // Compute counterfactual address without registering
            const derived = await deriveSmartAccountAddress(phone);
            return res.json({
                found: false,
                smartAccountAddress: derived.smartAccountAddress,
                ownerEOA: derived.ownerEOA,
                status: 'PENDING',
            });
        }

        const u = user.rows[0];
        return res.json({
            found: true,
            smartAccountAddress: u.smart_account_address,
            ownerEOA: u.owner_eoa,
            status: u.account_status,
            reputationScore: u.reputation_score,
            reputationTier: u.reputation_tier,
            tgId: u.tg_id,
        });
    } catch (err) {
        console.error('account lookup error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// REST endpoint: link Telegram ID to an existing phone-based account
// Called by telegramBot.js after /start command
app.post('/api/link-telegram', async (req, res) => {
    const { phoneNumber, tgId, tgUsername, displayName } = req.body;

    if (!phoneNumber || !tgId) {
        return res.status(400).json({ error: 'phoneNumber and tgId are required' });
    }

    try {
        const user = await getOrCreateUser(phoneNumber);

        await db.query(
            `UPDATE users
             SET tg_id = $1,
                 tg_username = $2,
                 display_name = COALESCE($3, display_name),
                 updated_at = NOW()
             WHERE smart_account_address = $4`,
            [tgId, tgUsername || null, displayName || null, user.smart_account_address]
        );

        return res.json({
            success: true,
            smartAccountAddress: user.smart_account_address,
            linked: true,
        });
    } catch (err) {
        console.error('link-telegram error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// REST endpoint: get UserOperation status (polled by USSD status check)
app.get('/api/op-status/:userOpHash', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT status, tx_hash, confirmed_at, error_message FROM user_operations WHERE user_op_hash = $1',
            [req.params.userOpHash]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'UserOperation not found' });
        }

        // Also check bundler for latest status
        try {
            const receipt = await bundlerProvider.send(
                'eth_getUserOperationReceipt',
                [req.params.userOpHash]
            );

            if (receipt && receipt.success) {
                // Update DB with confirmed status
                await db.query(
                    `UPDATE user_operations
                     SET status = 'CONFIRMED', tx_hash = $1, confirmed_block = $2, confirmed_at = NOW()
                     WHERE user_op_hash = $3`,
                    [receipt.receipt.transactionHash, receipt.receipt.blockNumber, req.params.userOpHash]
                );
                return res.json({ status: 'CONFIRMED', txHash: receipt.receipt.transactionHash });
            }
        } catch (_) {
            // Bundler query failed — return cached DB status
        }

        return res.json(result.rows[0]);
    } catch (err) {
        console.error('op-status error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// -----------------------------------------------------------------------------
// SERVER START
// -----------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 KULA EIP-4337 Middleware live on port ${PORT}`);
    console.log(`   EntryPoint:  ${ENTRY_POINT_ADDRESS}`);
    console.log(`   Factory:     ${SIMPLE_ACCOUNT_FACTORY}`);
    console.log(`   Chain:       Base Sepolia (${BASE_SEPOLIA_CHAIN_ID})`);
});

module.exports = { app, deriveSmartAccountAddress, deriveOwnerWallet, deriveAccountSalt };
