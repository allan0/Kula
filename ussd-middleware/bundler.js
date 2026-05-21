// =============================================================================
// FILE: ussd-middleware/bundler.js
// PURPOSE: Reusable EIP-4337 UserOperation construction and submission layer.
//
// This module is a pure-export library imported by server.js and (later)
// listener.js. It owns the full UserOperation lifecycle:
//
//   buildCallData()           → encode SmartAccount.execute()
//   buildContributeCallData() → USDC approve (if needed) + deposit() batch
//   buildInitCode()           → factory calldata for undeployed accounts
//   buildPaymasterAndData()   → Pimlico pm_sponsorUserOperation (+ local fallback)
//   computeUserOpHash()       → EIP-4337 v0.7 packed hash
//   submitUserOperation()     → assemble, sign, submit to Pimlico bundler
//   pollUserOpReceipt()       → poll bundler until confirmed or timeout
//
// DESIGN RULES:
//   ① No Express dependency — pure ethers.js.
//   ② No database access — the caller (server.js) owns DB writes.
//   ③ Key derivation is owned by server.js; this module receives a resolved
//      ownerWallet and smartAccountAddress.
//   ④ All UserOperation structs follow EIP-4337 v0.7 packed format matching
//      EntryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 (used in server.js).
//
// USAGE EXAMPLE (from server.js):
//   const { buildCallData, buildInitCode, submitUserOperation } = require('./bundler');
//   const callData = buildCallData(ROTARY_CONTRACT, rotaryIface.encodeFunctionData('createGroup', [...]))
//   const initCode = await buildInitCode(smartAccountAddress, ownerEOA, saltUint256)
//   const { userOpHash } = await submitUserOperation({ ownerWallet, smartAccountAddress, callData, initCode })
//
// DEPENDENCIES (all already in package.json):
//   "ethers": "^6.16.0"
// =============================================================================

'use strict';

const { ethers } = require('ethers');
require('dotenv').config();

// =============================================================================
// SECTION 1 — CONSTANTS & ENVIRONMENT
// =============================================================================

// EntryPoint v0.7 — canonical address, same on all EVM networks
const ENTRY_POINT_ADDRESS =
    process.env.ENTRY_POINT_ADDRESS ||
    '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Base Sepolia chain ID
const BASE_SEPOLIA_CHAIN_ID = 84532;

// Pimlico bundler RPC — v2 endpoint required for EntryPoint v0.7
const PIMLICO_RPC =
    `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${process.env.PIMLICO_API_KEY}`;

// VerifyingPaymaster (Pimlico-managed or self-deployed)
const PAYMASTER_ADDRESS = process.env.PAYMASTER_ADDRESS || '';

// SimpleAccountFactory address
const SIMPLE_ACCOUNT_FACTORY = process.env.SIMPLE_ACCOUNT_FACTORY || '';

// Base Sepolia USDC (Circle official)
const USDC_ADDRESS =
    process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// Gas defaults — conservative values tuned for Base Sepolia.
// Pimlico's pm_sponsorUserOperation will override these with tighter estimates.
const DEFAULT_GAS = {
    verificationGasLimit:     150_000n,
    callGasLimit:             200_000n,
    preVerificationGas:        50_000n,
    // Higher values when deploying the account for the first time in the same op
    initVerificationGasLimit: 400_000n,
    initCallGasLimit:         250_000n,
};

// =============================================================================
// SECTION 2 — PROVIDERS
// =============================================================================

// Read-only provider — nonce, allowance, getCode, fee data
const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);

// Bundler provider — eth_sendUserOperation, eth_getUserOperationReceipt,
//                    pm_sponsorUserOperation
const bundlerProvider = new ethers.JsonRpcProvider(PIMLICO_RPC);

// =============================================================================
// SECTION 3 — ABI INTERFACES
// =============================================================================

const SIMPLE_ACCOUNT_INTERFACE = new ethers.Interface([
    'function execute(address dest, uint256 value, bytes calldata func) external',
    'function executeBatch(address[] calldata dest, bytes[] calldata func) external',
    'function getNonce() external view returns (uint256)',
]);

const FACTORY_INTERFACE = new ethers.Interface([
    'function getAddress(address owner, uint256 salt) external view returns (address)',
    'function createAccount(address owner, uint256 salt) external returns (address)',
]);

const ENTRY_POINT_INTERFACE = new ethers.Interface([
    'function getNonce(address sender, uint192 key) external view returns (uint256)',
]);

const ERC20_INTERFACE = new ethers.Interface([
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
]);

// Shared EntryPoint instance (read-only)
const entryPoint = new ethers.Contract(
    ENTRY_POINT_ADDRESS,
    ENTRY_POINT_INTERFACE,
    provider
);

// =============================================================================
// SECTION 4 — CALLDATA BUILDERS
// =============================================================================

/**
 * Wraps an inner calldata into SimpleAccount.execute(target, 0, innerCalldata).
 *
 * This is the standard single-call wrapper used for every non-batched
 * USSD operation: createGroup, applyToJoin, and deposit (when allowance is OK).
 *
 * @param {string} targetContract  — Address of the contract being called
 * @param {string} innerCalldata   — ABI-encoded function call bytes
 * @param {bigint} [ethValue=0n]   — ETH value to send (always 0 for USDC flows)
 * @returns {string}               — Hex calldata for the UserOperation.callData field
 */
function buildCallData(targetContract, innerCalldata, ethValue = 0n) {
    return SIMPLE_ACCOUNT_INTERFACE.encodeFunctionData('execute', [
        targetContract,
        ethValue,
        innerCalldata,
    ]);
}

/**
 * Builds a batched callData for the "Contribute" USSD flow:
 *   [USDC.approve(RotaryGroup, MaxUint256), RotaryGroup.deposit(groupId, amount)]
 *
 * The USDC approve is omitted (falling back to a single execute) if the
 * Smart Account already has sufficient allowance — avoiding unnecessary gas.
 *
 * Using executeBatch means one UserOperation instead of two, halving bundler
 * overhead and improving the USSD confirmation UX.
 *
 * @param {string} smartAccountAddress — Used to check existing USDC allowance
 * @param {string} rotaryGroupAddress  — Deployed RotaryGroup contract address
 * @param {bigint} groupId             — Target ROSCA group ID
 * @param {bigint} amount              — USDC in 6-decimal units (10_000_000n = 10 USDC)
 * @returns {Promise<string>}          — Hex calldata for execute() or executeBatch()
 */
async function buildContributeCallData(
    smartAccountAddress,
    rotaryGroupAddress,
    groupId,
    amount
) {
    // Check the Smart Account's current USDC allowance to RotaryGroup
    let currentAllowance = 0n;
    try {
        const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_INTERFACE, provider);
        currentAllowance = await usdc.allowance(smartAccountAddress, rotaryGroupAddress);
    } catch (_) {
        // Account not yet deployed — allowance is 0
    }

    // Encode RotaryGroup.deposit(groupId, amount)
    const depositCalldata = new ethers.Interface([
        'function deposit(uint256 _groupId, uint256 _amount) external',
    ]).encodeFunctionData('deposit', [groupId, amount]);

    if (currentAllowance >= amount) {
        // Allowance sufficient — single execute()
        return buildCallData(rotaryGroupAddress, depositCalldata);
    }

    // Need to approve first — batch approve + deposit in one UserOperation
    const approveCalldata = ERC20_INTERFACE.encodeFunctionData('approve', [
        rotaryGroupAddress,
        ethers.MaxUint256, // Approve max once to avoid repeated approvals
    ]);

    return SIMPLE_ACCOUNT_INTERFACE.encodeFunctionData('executeBatch', [
        [USDC_ADDRESS, rotaryGroupAddress],
        [approveCalldata, depositCalldata],
    ]);
}

// =============================================================================
// SECTION 5 — INITCODE BUILDER
// =============================================================================

/**
 * Constructs the initCode field for a UserOperation.
 *
 * Returns '0x' if the Smart Account is already deployed on-chain.
 * Otherwise returns: factory address (20 bytes) + createAccount(owner, salt) calldata
 *
 * The EntryPoint reads the first 20 bytes of initCode as the factory address,
 * calls the remainder as calldata, and expects the factory to deploy the account.
 * The counterfactual address must match — guaranteed by the same (owner, salt) pair
 * used in deriveSmartAccountAddress() in server.js.
 *
 * @param {string} smartAccountAddress — Pre-computed counterfactual address
 * @param {string} ownerEOA            — Owner EOA from deriveOwnerWallet()
 * @param {bigint} saltUint256         — uint256 salt from deriveAccountSalt()
 * @param {string} [accountStatus]     — Pass 'DEPLOYED' to skip the getCode() call
 * @returns {Promise<string>}          — '0x' or encoded initCode hex
 */
async function buildInitCode(smartAccountAddress, ownerEOA, saltUint256, accountStatus) {
    // Fast path — caller already confirmed account is deployed
    if (accountStatus === 'DEPLOYED') return '0x';

    const code = await provider.getCode(smartAccountAddress);
    if (code !== '0x') return '0x'; // Already deployed on-chain

    // Encode createAccount(ownerEOA, salt) for the factory
    const createAccountCalldata = FACTORY_INTERFACE.encodeFunctionData(
        'createAccount',
        [ownerEOA, saltUint256]
    );

    // initCode = factory address + encoded calldata (no separator)
    return ethers.concat([SIMPLE_ACCOUNT_FACTORY, createAccountCalldata]);
}

// =============================================================================
// SECTION 6 — USEROPERATION HASH (EIP-4337 v0.7)
// =============================================================================

/**
 * Computes the canonical EIP-4337 v0.7 UserOperation hash.
 *
 * This is what the owner signs in step 8 of submitUserOperation(), and what
 * the VerifyingPaymaster validates when authorising gas sponsorship.
 *
 * Construction (per EIP-4337 v0.7 spec):
 *   innerHash = keccak256(abi.encode(
 *       sender, nonce,
 *       keccak256(initCode), keccak256(callData),
 *       accountGasLimits, preVerificationGas, gasFees,
 *       keccak256(paymasterAndData)
 *   ))
 *   userOpHash = keccak256(abi.encode(innerHash, entryPoint, chainId))
 *
 * Identical to computeUserOpHash() in server.js — kept in both files so each
 * module can compute hashes independently without circular imports.
 *
 * @param {object} userOp          — Complete (signed or pre-sign) UserOperation
 * @param {string} entryPointAddr  — EntryPoint contract address
 * @param {number} chainId         — Chain ID (84532 for Base Sepolia)
 * @returns {string}               — 0x-prefixed 32-byte hash
 */
function computeUserOpHash(userOp, entryPointAddr, chainId) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    const packedUserOp = abiCoder.encode(
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

    // Chain + entryPoint binding prevents cross-chain replay attacks
    return ethers.keccak256(
        abiCoder.encode(
            ['bytes32', 'address', 'uint256'],
            [innerHash, entryPointAddr, chainId]
        )
    );
}

// =============================================================================
// SECTION 7 — PAYMASTER INTEGRATION
// =============================================================================

/**
 * Builds the paymasterAndData field, covering gas sponsorship for the user.
 *
 * PRIMARY PATH — Pimlico pm_sponsorUserOperation:
 *   Sends the unsigned UserOperation to Pimlico's paymaster API.
 *   Returns paymasterAndData already encoded, plus updated gas estimates
 *   that account for paymaster verification overhead.
 *   Requires a Pimlico account with an active sponsorship policy.
 *   PIMLICO_SPONSORSHIP_POLICY_ID can be set in .env for policy-gated sponsorship.
 *
 * FALLBACK PATH — local VerifyingPaymaster:
 *   Used if Pimlico fails (rate limit, policy rejection, network issue) or
 *   during local development with a self-deployed VerifyingPaymaster.
 *   Requires PAYMASTER_SIGNER_KEY and PAYMASTER_ADDRESS in .env.
 *
 * paymasterAndData encoding (20 + 6 + 6 + 65 = 97 bytes):
 *   [paymasterAddress][validUntil][validAfter][signature]
 *
 * @param {object} userOp              — Preliminary UserOp with '0x' paymasterAndData
 * @param {string} smartAccountAddress — For debug logging only
 * @returns {Promise<{ paymasterAndData: string, updatedGasLimits: object|null }>}
 */
async function buildPaymasterAndData(userOp, smartAccountAddress) {

    // ─── PRIMARY: Pimlico pm_sponsorUserOperation ─────────────────────────────
    try {
        const params = [userOp, ENTRY_POINT_ADDRESS];

        if (process.env.PIMLICO_SPONSORSHIP_POLICY_ID) {
            params.push({ sponsorshipPolicyId: process.env.PIMLICO_SPONSORSHIP_POLICY_ID });
        }

        const result = await bundlerProvider.send('pm_sponsorUserOperation', params);

        if (!result?.paymasterAndData) {
            throw new Error('pm_sponsorUserOperation returned no paymasterAndData');
        }

        console.log(`⛽ Pimlico sponsorship approved for: ${smartAccountAddress}`);

        return {
            paymasterAndData: result.paymasterAndData,
            updatedGasLimits: {
                callGasLimit:         result.callGasLimit         || null,
                verificationGasLimit: result.verificationGasLimit || null,
                preVerificationGas:   result.preVerificationGas   || null,
            },
        };

    } catch (pimlicoErr) {
        console.warn(
            '⚠️  Pimlico sponsorship failed, using local paymaster fallback:',
            pimlicoErr.message
        );
    }

    // ─── FALLBACK: Local VerifyingPaymaster ───────────────────────────────────
    if (!process.env.PAYMASTER_SIGNER_KEY || !PAYMASTER_ADDRESS) {
        throw new Error(
            'Paymaster unavailable: pm_sponsorUserOperation failed and ' +
            'PAYMASTER_SIGNER_KEY / PAYMASTER_ADDRESS are not set.'
        );
    }

    const paymasterSigner = new ethers.Wallet(process.env.PAYMASTER_SIGNER_KEY);

    // 1-hour validity window
    const validAfter = 0n;
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // The data the paymaster signs: its own address + validity window
    const paymasterDataToSign = ethers.solidityPacked(
        ['address', 'uint48', 'uint48'],
        [PAYMASTER_ADDRESS, validUntil, validAfter]
    );

    // The hash the VerifyingPaymaster verifies on-chain (Ethereum signed message format)
    const paymasterHash = ethers.keccak256(
        ethers.concat([
            ethers.toUtf8Bytes('\x19Ethereum Signed Message:\n32'),
            ethers.keccak256(paymasterDataToSign),
        ])
    );

    const paymasterSignature = await paymasterSigner.signMessage(
        ethers.getBytes(paymasterHash)
    );

    const paymasterAndData = ethers.solidityPacked(
        ['address', 'uint48', 'uint48', 'bytes'],
        [PAYMASTER_ADDRESS, validUntil, validAfter, paymasterSignature]
    );

    console.log(`🔐 Local paymaster signature built for: ${smartAccountAddress}`);
    return { paymasterAndData, updatedGasLimits: null };
}

// =============================================================================
// SECTION 8 — CORE: submitUserOperation
// =============================================================================

/**
 * Assembles, signs, and submits a complete EIP-4337 v0.7 UserOperation.
 *
 * This is the single function server.js calls for every on-chain action.
 * The caller provides a fully-resolved ownerWallet and pre-encoded callData.
 * This function handles everything from nonce fetch to bundler submission.
 *
 * STEPS:
 *   1. Fetch nonce from EntryPoint.getNonce(sender, 0)
 *   2. Get EIP-1559 gas prices from Base L2
 *   3. Pack gas limits into bytes32 (v0.7 packed format)
 *   4. Build preliminary UserOperation (empty paymasterAndData + dummy signature)
 *   5. Call buildPaymasterAndData() → pm_sponsorUserOperation (or local fallback)
 *   6. Apply gas overrides from Pimlico response if present
 *   7. Compute final UserOpHash with computeUserOpHash()
 *   8. Owner EOA signs the hash (signMessage adds Ethereum prefix)
 *   9. Submit via eth_sendUserOperation
 *   10. Return { userOpHash, userOp } — caller logs to DB
 *
 * @param {object}        params
 * @param {ethers.Wallet} params.ownerWallet         — From server.js deriveOwnerWallet()
 * @param {string}        params.smartAccountAddress — Pre-computed Smart Account address
 * @param {string}        params.callData            — From buildCallData() or buildContributeCallData()
 * @param {string}        params.initCode            — From buildInitCode() ('0x' if deployed)
 * @param {string}        [params.accountStatus]     — 'DEPLOYED' | 'PENDING' (informational)
 * @returns {Promise<{ userOpHash: string, userOp: object }>}
 */
async function submitUserOperation({
    ownerWallet,
    smartAccountAddress,
    callData,
    initCode,
    accountStatus,
}) {
    const isDeployment = initCode !== '0x';

    // ─── 1. Nonce ─────────────────────────────────────────────────────────────
    const nonce = await entryPoint.getNonce(smartAccountAddress, 0n);
    console.log(`📟 Nonce for ${smartAccountAddress}: ${nonce}`);

    // ─── 2. Gas prices (EIP-1559) ─────────────────────────────────────────────
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas ?? ethers.parseUnits('0.005', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? ethers.parseUnits('0.001', 'gwei');

    // ─── 3. Pack gas limits into bytes32 (EIP-4337 v0.7 packed format) ────────
    //   accountGasLimits = verificationGasLimit (uint128) | callGasLimit (uint128)
    //   gasFees          = maxPriorityFeePerGas (uint128) | maxFeePerGas (uint128)
    const verificationGasLimit = isDeployment
        ? DEFAULT_GAS.initVerificationGasLimit
        : DEFAULT_GAS.verificationGasLimit;
    const callGasLimit = isDeployment
        ? DEFAULT_GAS.initCallGasLimit
        : DEFAULT_GAS.callGasLimit;

    const accountGasLimits = ethers.solidityPacked(
        ['uint128', 'uint128'],
        [verificationGasLimit, callGasLimit]
    );
    const gasFees = ethers.solidityPacked(
        ['uint128', 'uint128'],
        [maxPriorityFeePerGas, maxFeePerGas]
    );

    // ─── 4. Preliminary UserOperation ────────────────────────────────────────
    const preliminaryUserOp = {
        sender:             smartAccountAddress,
        nonce:              ethers.toBeHex(nonce),
        initCode:           initCode,
        callData:           callData,
        accountGasLimits:   accountGasLimits,
        preVerificationGas: ethers.toBeHex(DEFAULT_GAS.preVerificationGas),
        gasFees:            gasFees,
        paymasterAndData:   '0x',                    // Populated in step 5
        signature:          '0x' + 'ec'.repeat(65),  // Dummy 65-byte sig for estimation
    };

    // ─── 5. Get paymasterAndData (Pimlico or local fallback) ──────────────────
    const { paymasterAndData, updatedGasLimits } = await buildPaymasterAndData(
        preliminaryUserOp,
        smartAccountAddress
    );

    // ─── 6. Apply Pimlico's gas overrides if provided ─────────────────────────
    let finalAccountGasLimits = accountGasLimits;
    let finalPreVerificationGas = ethers.toBeHex(DEFAULT_GAS.preVerificationGas);

    if (updatedGasLimits?.verificationGasLimit && updatedGasLimits?.callGasLimit) {
        finalAccountGasLimits = ethers.solidityPacked(
            ['uint128', 'uint128'],
            [
                BigInt(updatedGasLimits.verificationGasLimit),
                BigInt(updatedGasLimits.callGasLimit),
            ]
        );
        console.log('⛽ Applied Pimlico gas estimates to final UserOp');
    }
    if (updatedGasLimits?.preVerificationGas) {
        finalPreVerificationGas = ethers.toBeHex(BigInt(updatedGasLimits.preVerificationGas));
    }

    // ─── 7. Final UserOperation (real paymasterAndData, ready for signing) ────
    const userOp = {
        ...preliminaryUserOp,
        accountGasLimits:   finalAccountGasLimits,
        preVerificationGas: finalPreVerificationGas,
        paymasterAndData:   paymasterAndData,
        signature:          '0x', // Set in step 8
    };

    // ─── 8. Compute UserOpHash and sign with owner EOA ────────────────────────
    const userOpHash = computeUserOpHash(userOp, ENTRY_POINT_ADDRESS, BASE_SEPOLIA_CHAIN_ID);
    console.log(`🔏 UserOpHash: ${userOpHash}`);

    // signMessage() prepends "\x19Ethereum Signed Message:\n32" — matches
    // what the EntryPoint's validateUserOp() call on SimpleAccount verifies.
    const ownerSignature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = ownerSignature;

    // ─── 9. Submit to Pimlico bundler ─────────────────────────────────────────
    console.log(`📤 Submitting UserOperation for ${smartAccountAddress}...`);
    const submittedHash = await bundlerProvider.send(
        'eth_sendUserOperation',
        [userOp, ENTRY_POINT_ADDRESS]
    );

    console.log(`✅ UserOperation submitted: ${submittedHash}`);
    if (isDeployment) {
        console.log(`🏗️  Smart Account deployment included in this UserOperation`);
    }

    // Return the hash and full UserOp — server.js writes both to user_operations table
    return { userOpHash: submittedHash, userOp };
}

// =============================================================================
// SECTION 9 — RECEIPT POLLING
// =============================================================================

/**
 * Polls eth_getUserOperationReceipt until the UserOp is confirmed or times out.
 *
 * Called by:
 *   - server.js /api/op-status endpoint (per-request polling)
 *   - listener.js (polls after detecting a ContributionReceived event to confirm
 *     the matching UserOp before sending Telegram notifications)
 *
 * Pimlico's bundler returns null while the UserOp is pending in the mempool.
 * Once included, the receipt contains success flag, txHash, and blockNumber.
 *
 * @param {string} userOpHash              — From eth_sendUserOperation
 * @param {object} [options]
 * @param {number} [options.maxWaitMs]     — Timeout in ms (default: 120_000 = 2 min)
 * @param {number} [options.pollIntervalMs]— Poll interval in ms (default: 3_000 = 3s)
 * @returns {Promise<{
 *   success: boolean,
 *   txHash:  string|null,
 *   blockNumber: number|null,
 *   reason:  string|null
 * }>}
 */
async function pollUserOpReceipt(userOpHash, options = {}) {
    const { maxWaitMs = 120_000, pollIntervalMs = 3_000 } = options;
    const deadline = Date.now() + maxWaitMs;

    console.log(`⏳ Polling receipt for UserOp: ${userOpHash}`);

    while (Date.now() < deadline) {
        try {
            const receipt = await bundlerProvider.send(
                'eth_getUserOperationReceipt',
                [userOpHash]
            );

            if (receipt !== null) {
                const success = receipt.success === true;
                const txHash = receipt.receipt?.transactionHash ?? null;
                const blockNumber = receipt.receipt?.blockNumber
                    ? parseInt(receipt.receipt.blockNumber, 16)
                    : null;

                if (success) {
                    console.log(`✅ UserOp confirmed — tx: ${txHash} block: ${blockNumber}`);
                } else {
                    console.warn(`❌ UserOp reverted — reason: ${receipt.reason ?? 'unknown'}`);
                }

                return { success, txHash, blockNumber, reason: receipt.reason ?? null };
            }
        } catch (err) {
            // Null receipt while pending is not an error — log only unexpected failures
            if (!err.message?.toLowerCase().includes('null')) {
                console.warn(`Polling error: ${err.message}`);
            }
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    console.warn(`⏰ Receipt polling timed out for: ${userOpHash}`);
    return { success: false, txHash: null, blockNumber: null, reason: 'Polling timeout' };
}

// =============================================================================
// SECTION 10 — EXPORTS
// =============================================================================

module.exports = {
    // ── CallData builders (used by server.js USSD menu handlers) ──────────────
    buildCallData,
    buildContributeCallData,

    // ── initCode builder (used by server.js before submitUserOperation) ────────
    buildInitCode,

    // ── Core UserOp pipeline ───────────────────────────────────────────────────
    buildPaymasterAndData,
    computeUserOpHash,
    submitUserOperation,

    // ── Receipt polling (server.js /api/op-status + listener.js) ──────────────
    pollUserOpReceipt,

    // ── Constants (re-exported so server.js + listener.js stay in sync) ────────
    ENTRY_POINT_ADDRESS,
    BASE_SEPOLIA_CHAIN_ID,
    PIMLICO_RPC,

    // ── Provider references (listener.js uses provider for event subscriptions) ─
    provider,
    bundlerProvider,
};
