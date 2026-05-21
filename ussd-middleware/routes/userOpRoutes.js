// FILE: ussd-middleware/routes/userOpRoutes.js
// PURPOSE: API endpoints that enable the frontend to submit gasless
//          EIP-4337 UserOperations without exposing Pimlico API keys.
//
// ENDPOINTS:
//   POST /api/prepare-userop
//     → Builds the unsigned UserOperation for a given operation type.
//     → Returns: { userOp, userOpHash }
//     → The frontend signs userOpHash with the embedded wallet.
//
//   POST /api/submit-userop
//     → Receives the signed UserOperation, attaches Pimlico paymasterAndData,
//       and submits to the bundler.
//     → Returns: { success, userOpHash }
//
//   POST /api/sign-userop
//     → For Telegram/USSD users whose ownerEOA key is server-held.
//     → Signs the userOpHash with the derived private key.
//     → Returns: { success, signature }
//     (The frontend then calls submit-userop with the signature.)

'use strict';

const express    = require('express');
const { ethers } = require('ethers');
const { Pool }   = require('pg');

const router = express.Router();
const db     = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// INFRASTRUCTURE
// ---------------------------------------------------------------------------

const BASE_SEPOLIA_CHAIN_ID = 84532;
const ENTRY_POINT_ADDRESS   = process.env.ENTRY_POINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const PIMLICO_RPC           = `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${process.env.PIMLICO_API_KEY}`;
const USDC_ADDRESS          = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const ROTARY_ADDRESS        = process.env.ROTARY_GROUP_CONTRACT    || '';
const SIMPLE_ACCOUNT_FACTORY = process.env.SIMPLE_ACCOUNT_FACTORY || '';

const provider        = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
const bundlerProvider = new ethers.JsonRpcProvider(PIMLICO_RPC);

// ---------------------------------------------------------------------------
// ABI FRAGMENTS
// ---------------------------------------------------------------------------

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
];

const ROTARY_ABI = [
    'function deposit(uint256 _groupId, uint256 _amount) external',
    'function voteOnAssetProposal(uint256 _proposalId, bool _support) external',
    'function proposeAsset(uint256 _groupId, uint256 _registryAssetId, string calldata _description, uint256 _requestedAmount) external returns (uint256)',
    'function voteOnApplicant(uint256 _groupId, address _applicant, bool _support) external',
];

const ENTRY_POINT_ABI = [
    'function getNonce(address sender, uint192 key) external view returns (uint256)',
];

const FACTORY_ABI = [
    'function getAddress(address owner, uint256 salt) external view returns (address)',
    'function createAccount(address owner, uint256 salt) external returns (address)',
];

const SIMPLE_ACCOUNT_ABI = [
    'function execute(address dest, uint256 value, bytes calldata func) external',
    'function executeBatch(address[] calldata dest, bytes[] calldata func) external',
];

const entryPoint    = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, provider);
const factoryContract = new ethers.Contract(SIMPLE_ACCOUNT_FACTORY, FACTORY_ABI, provider);

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const rotaryIface = new ethers.Interface(ROTARY_ABI);
const erc20Iface  = new ethers.Interface(ERC20_ABI);
const saIface     = new ethers.Interface(SIMPLE_ACCOUNT_ABI);

/**
 * Builds callData for the Smart Account to execute.
 * For deposit: batches approve(USDC, RotaryGroup, amount) + deposit(groupId, amount).
 * For other ops: single execute() call.
 */
function buildCallData(operationType, params) {
    if (operationType === 'deposit') {
        const { groupId, amountUsdc } = params;
        const amount = BigInt(amountUsdc);

        // approve(rotaryGroup, amount)
        const approveData = erc20Iface.encodeFunctionData('approve', [ROTARY_ADDRESS, amount]);
        // deposit(groupId, amount)
        const depositData = rotaryIface.encodeFunctionData('deposit', [BigInt(groupId), amount]);

        return saIface.encodeFunctionData('executeBatch', [
            [USDC_ADDRESS, ROTARY_ADDRESS],
            [approveData, depositData],
        ]);
    }

    if (operationType === 'vote_asset') {
        const { proposalId, support } = params;
        const inner = rotaryIface.encodeFunctionData('voteOnAssetProposal', [BigInt(proposalId), support]);
        return saIface.encodeFunctionData('execute', [ROTARY_ADDRESS, 0n, inner]);
    }

    if (operationType === 'propose_asset') {
        const { groupId, registryAssetId, description, requestedAmount } = params;
        const inner = rotaryIface.encodeFunctionData('proposeAsset', [
            BigInt(groupId), BigInt(registryAssetId), description, BigInt(requestedAmount),
        ]);
        return saIface.encodeFunctionData('execute', [ROTARY_ADDRESS, 0n, inner]);
    }

    if (operationType === 'vote_applicant') {
        const { groupId, applicant, support } = params;
        const inner = rotaryIface.encodeFunctionData('voteOnApplicant', [BigInt(groupId), applicant, support]);
        return saIface.encodeFunctionData('execute', [ROTARY_ADDRESS, 0n, inner]);
    }

    throw new Error(`Unknown operationType: ${operationType}`);
}

/**
 * Checks if the Smart Account is already deployed (has code).
 * If not, builds initCode for the factory.
 */
async function buildInitCode(smartAccountAddress, ownerEOA) {
    const code = await provider.getCode(smartAccountAddress);
    if (code && code !== '0x') return '0x'; // Already deployed

    const createData = factoryContract.interface.encodeFunctionData('createAccount', [ownerEOA, BigInt(0)]);
    return ethers.concat([SIMPLE_ACCOUNT_FACTORY, createData]);
}

/**
 * Builds complete unsigned UserOperation.
 */
async function buildUserOp(smartAccountAddress, ownerEOA, callData) {
    const [nonce, initCode, feeData] = await Promise.all([
        entryPoint.getNonce(smartAccountAddress, BigInt(0)),
        buildInitCode(smartAccountAddress, ownerEOA),
        provider.getFeeData(),
    ]);

    const maxFeePerGas         = feeData.maxFeePerGas         ?? ethers.parseUnits('2', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');

    return {
        sender:               smartAccountAddress,
        nonce:                `0x${nonce.toString(16)}`,
        initCode:             initCode,
        callData:             callData,
        callGasLimit:         `0x${(BigInt(400_000)).toString(16)}`,
        verificationGasLimit: `0x${(BigInt(150_000)).toString(16)}`,
        preVerificationGas:   `0x${(BigInt(50_000)).toString(16)}`,
        maxFeePerGas:         `0x${maxFeePerGas.toString(16)}`,
        maxPriorityFeePerGas: `0x${maxPriorityFeePerGas.toString(16)}`,
        paymasterAndData:     '0x',
        signature:            '0x',
    };
}

/**
 * Computes EIP-4337 UserOperation hash.
 */
function computeUserOpHash(userOp) {
    const packed = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
        [
            userOp.sender,
            BigInt(userOp.nonce),
            ethers.keccak256(userOp.initCode),
            ethers.keccak256(userOp.callData),
            BigInt(userOp.callGasLimit),
            BigInt(userOp.verificationGasLimit),
            BigInt(userOp.preVerificationGas),
            BigInt(userOp.maxFeePerGas),
            BigInt(userOp.maxPriorityFeePerGas),
            ethers.keccak256(userOp.paymasterAndData),
        ]
    );
    const innerHash = ethers.keccak256(packed);
    return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'address', 'uint256'],
            [innerHash, ENTRY_POINT_ADDRESS, BASE_SEPOLIA_CHAIN_ID]
        )
    );
}

/**
 * Sponsors the UserOperation via Pimlico pm_sponsorUserOperation.
 */
async function sponsorUserOp(userOp) {
    const result = await bundlerProvider.send('pm_sponsorUserOperation', [
        userOp,
        ENTRY_POINT_ADDRESS,
        { sponsorshipPolicyId: process.env.PIMLICO_SPONSORSHIP_POLICY_ID || undefined },
    ]);
    return result.paymasterAndData;
}

// ---------------------------------------------------------------------------
// ROUTE: POST /api/prepare-userop
// ---------------------------------------------------------------------------

router.post('/prepare-userop', async (req, res) => {
    const { smartAccountAddress, operationType, ...params } = req.body;

    if (!smartAccountAddress || !operationType) {
        return res.status(400).json({ success: false, error: 'smartAccountAddress and operationType required' });
    }

    try {
        // Fetch ownerEOA from DB
        const { rows } = await db.query(
            'SELECT owner_eoa FROM users WHERE smart_account_address = $1',
            [smartAccountAddress.toLowerCase()]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const ownerEOA = rows[0].owner_eoa;

        const callData   = buildCallData(operationType, params);
        const userOp     = await buildUserOp(smartAccountAddress, ownerEOA, callData);
        const userOpHash = computeUserOpHash(userOp);

        return res.json({ success: true, userOp, userOpHash });
    } catch (err) {
        console.error('prepare-userop error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// ROUTE: POST /api/submit-userop
// ---------------------------------------------------------------------------

router.post('/submit-userop', async (req, res) => {
    const { smartAccountAddress, userOp, operationType, ...params } = req.body;

    if (!smartAccountAddress || !userOp) {
        return res.status(400).json({ success: false, error: 'smartAccountAddress and userOp required' });
    }

    try {
        // Sponsor via Pimlico (get paymasterAndData)
        const paymasterAndData = await sponsorUserOp({ ...userOp, signature: '0x' });
        const finalOp = { ...userOp, paymasterAndData };

        // Submit
        const opHash = await bundlerProvider.send('eth_sendUserOperation', [
            finalOp,
            ENTRY_POINT_ADDRESS,
        ]);

        // Persist
        await db.query(
            `INSERT INTO user_operations (
                smart_account_address, user_op_hash, operation_type,
                call_data, usdc_amount, group_id, status,
                paymaster_sponsored, bundler_endpoint, submitted_at
            ) VALUES ($1,$2,$3,$4,$5,$6,'SUBMITTED',true,$7,NOW())`,
            [
                smartAccountAddress,
                opHash,
                operationType || 'unknown',
                userOp.callData,
                params.amountUsdc ? String(params.amountUsdc) : null,
                params.groupId    ? Number(params.groupId)    : null,
                PIMLICO_RPC,
            ]
        );

        return res.json({ success: true, userOpHash: opHash });
    } catch (err) {
        console.error('submit-userop error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// ROUTE: POST /api/sign-userop
// For Telegram/USSD users whose owner key is server-derived.
// ---------------------------------------------------------------------------

router.post('/sign-userop', async (req, res) => {
    const { smartAccountAddress, userOpHash } = req.body;

    if (!smartAccountAddress || !userOpHash) {
        return res.status(400).json({ success: false, error: 'smartAccountAddress and userOpHash required' });
    }

    try {
        // Fetch derivation info from DB
        const { rows } = await db.query(
            'SELECT tg_id, onboarding_channel, owner_eoa FROM users WHERE smart_account_address = $1',
            [smartAccountAddress.toLowerCase()]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const user = rows[0];

        // Only sign for non-Privy channels
        if (user.onboarding_channel === 'PRIVY') {
            return res.status(403).json({
                success: false,
                error:   'Privy users must sign on the client side',
            });
        }

        // Derive the owner key
        const seed      = user.tg_id || user.owner_eoa;
        const innerHash = ethers.keccak256(ethers.toUtf8Bytes(String(seed)));
        const privKey   = ethers.keccak256(
            ethers.concat([
                ethers.getBytes(innerHash),
                ethers.toUtf8Bytes(process.env.KULA_SALT_SECRET),
            ])
        );
        const ownerWallet = new ethers.Wallet(privKey);
        const signature   = await ownerWallet.signMessage(ethers.getBytes(userOpHash));

        return res.json({ success: true, signature });
    } catch (err) {
        console.error('sign-userop error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
