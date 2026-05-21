// =============================================================================
// FILE: ussd-middleware/routes/verifyAsset.js
// PURPOSE: Phase 4 – Kula Oracle Express route for RWA document verification
//
// ENDPOINT: POST /api/verify-asset
// CONTENT-TYPE: multipart/form-data
//
// FORM FIELDS:
//   file         (required) — The document image (JPEG, PNG, or PDF)
//   assetId      (required) — The KulaPublicRegistry asset ID (uint256 string)
//   context      (optional) — Human-readable hint e.g. "Kenyan land deed, Kiambu County"
//
// PIPELINE:
//   1. Validate incoming multipart upload via multer (memory storage, 10MB limit)
//   2. Upload the file buffer to IPFS via @pinata/sdk → get ipfsCID
//   3. Convert buffer to base64 data URL → pass to OpenAI gpt-4o vision
//      using the strict JSON system prompt from assetVisionPrompt.js
//   4. Parse and validate the JSON response
//   5. Compute keccak256(fileBuffer) as the assetHash for on-chain identity
//   6. IF document_authenticity_score > 0.85:
//        a. Use the Oracle Wallet (ORACLE_PRIVATE_KEY) to call
//           KulaPublicRegistry.verify(assetHash, ipfsCID) on Base Sepolia
//        b. Record the tx hash in the DB
//   7. Return full analysis result to the caller
//
// ENV VARS REQUIRED:
//   PINATA_API_KEY          — Pinata IPFS API key
//   PINATA_SECRET_API_KEY   — Pinata IPFS API secret
//   OPENAI_API_KEY          — OpenAI API key (gpt-4o access required)
//   ORACLE_PRIVATE_KEY      — Private key of the oracle wallet (holds Base Sepolia ETH)
//   BASE_SEPOLIA_RPC        — Base Sepolia JSON-RPC URL
//   KULA_REGISTRY_ADDRESS   — Deployed KulaPublicRegistry contract address
//   DATABASE_URL            — PostgreSQL connection string
//
// DEPENDENCIES (add to ussd-middleware/package.json):
//   "@pinata/sdk": "^2.1.0"
//   "openai": "^4.x"
//   "multer": "^1.4.5-lts.1"
//   "ethers": "^6.x"  (already present)
// =============================================================================

'use strict';

const express  = require('express');
const multer   = require('multer');
const PinataSDK = require('@pinata/sdk');
const OpenAI   = require('openai');
const { ethers } = require('ethers');
const { Pool } = require('pg');

const {
    buildAssetVisionMessages,
    parseVisionResponse,
    OPENAI_CALL_OPTIONS,
} = require('../../backend/prompts/assetVisionPrompt');

const router = express.Router();

// ---------------------------------------------------------------------------
// INFRASTRUCTURE
// ---------------------------------------------------------------------------

// Multer — memory storage, 10MB limit, image/pdf only
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, PDF`));
        }
    },
});

// Pinata IPFS client
const pinata = new PinataSDK(
    process.env.PINATA_API_KEY,
    process.env.PINATA_SECRET_API_KEY,
);

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Base Sepolia provider + Oracle wallet (signs the on-chain verify() call)
const provider     = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
const oracleWallet = new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY || '0x0', provider);

// KulaPublicRegistry ABI — only the functions we call
const REGISTRY_ABI = [
    'function verify(bytes32 _assetHash, string calldata _ipfsCID) external',
    'function getAsset(uint256 _assetId) external view returns (uint256,address,string,string,uint256,uint256,bool,bool)',
];

const registryContract = new ethers.Contract(
    process.env.KULA_REGISTRY_ADDRESS,
    REGISTRY_ABI,
    oracleWallet, // Connected signer — required for write calls
);

// PostgreSQL
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Authenticity threshold for automatic on-chain verification
const AUTHENTICITY_THRESHOLD = 0.85;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Uploads a file buffer to IPFS via Pinata.
 * Returns the IPFS CID string (e.g. "QmXyz...").
 *
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} mimeType
 * @returns {Promise<string>} IPFS CID
 */
async function uploadToIPFS(buffer, originalName, mimeType) {
    const { Readable } = require('stream');

    // Pinata requires a readable stream
    const stream = Readable.from(buffer);
    // @ts-ignore — pinataStream expects a ReadableStream with .path
    stream.path = originalName;

    const options = {
        pinataMetadata: {
            name:    `kula-asset-${Date.now()}-${originalName}`,
            keyvalues: { source: 'kula-oracle', mimeType },
        },
        pinataOptions: { cidVersion: 1 },
    };

    const result = await pinata.pinFileToIPFS(stream, options);
    return result.IpfsHash;
}

/**
 * Converts a file buffer to an OpenAI-compatible image URL.
 * For PDFs, we convert only the MIME type hint — gpt-4o can read PDF images
 * when passed as base64. For images, we use a data URL directly.
 *
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {string} base64 data URL
 */
function bufferToDataUrl(buffer, mimeType) {
    const b64 = buffer.toString('base64');
    // gpt-4o vision accepts data URLs for image types
    // For PDFs, use image/jpeg as a hint (Pinata renders the first page)
    const safeMime = mimeType === 'application/pdf' ? 'image/jpeg' : mimeType;
    return `data:${safeMime};base64,${b64}`;
}

/**
 * Computes keccak256 of the raw file buffer — used as the assetHash for
 * on-chain identity linking between IPFS and the smart contract.
 *
 * @param {Buffer} buffer
 * @returns {string} 0x-prefixed 32-byte hex hash
 */
function computeAssetHash(buffer) {
    return ethers.keccak256(new Uint8Array(buffer));
}

/**
 * Calls KulaPublicRegistry.verify(assetHash, ipfsCID) on Base Sepolia.
 * The oracle wallet must have ETH to pay gas.
 *
 * @param {string} assetHash  bytes32 keccak256 of the document
 * @param {string} ipfsCID    IPFS CID from Pinata
 * @returns {Promise<ethers.TransactionReceipt>}
 */
async function triggerOnChainVerification(assetHash, ipfsCID) {
    const tx = await registryContract.verify(
        assetHash,
        ipfsCID,
        {
            gasLimit: 200_000n, // Conservative fixed limit — avoids gas estimation failures
        },
    );

    console.log(`⛓  Oracle tx submitted: ${tx.hash}`);
    const receipt = await tx.wait(1); // Wait for 1 confirmation
    console.log(`✅ Oracle tx confirmed in block ${receipt.blockNumber}`);
    return receipt;
}

/**
 * Records the verification result in the DB for auditing and frontend polling.
 *
 * @param {object} params
 */
async function recordVerificationResult({
    assetId,
    ipfsCID,
    assetHash,
    analysisResult,
    txHash,
    autoVerified,
}) {
    try {
        await db.query(
            `INSERT INTO asset_verifications (
                asset_id,
                ipfs_cid,
                asset_hash,
                owner_name,
                asset_type,
                estimated_value_usd,
                authenticity_score,
                confidence,
                document_number,
                issuing_authority,
                issue_date,
                location,
                red_flags,
                extraction_notes,
                auto_verified,
                oracle_tx_hash,
                verified_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
            ON CONFLICT (asset_id) DO UPDATE
                SET ipfs_cid             = EXCLUDED.ipfs_cid,
                    asset_hash           = EXCLUDED.asset_hash,
                    authenticity_score   = EXCLUDED.authenticity_score,
                    auto_verified        = EXCLUDED.auto_verified,
                    oracle_tx_hash       = EXCLUDED.oracle_tx_hash,
                    verified_at          = NOW()`,
            [
                assetId,
                ipfsCID,
                assetHash,
                analysisResult.owner,
                analysisResult.asset_type,
                analysisResult.estimated_value,
                analysisResult.document_authenticity_score,
                analysisResult.confidence,
                analysisResult.document_number,
                analysisResult.issuing_authority,
                analysisResult.issue_date   !== 'UNKNOWN' ? analysisResult.issue_date : null,
                analysisResult.location,
                JSON.stringify(analysisResult.red_flags),
                analysisResult.extraction_notes,
                autoVerified,
                txHash || null,
            ],
        );
    } catch (dbErr) {
        // Non-fatal — log but don't fail the request
        console.error('recordVerificationResult DB error:', dbErr.message);
    }
}

// ---------------------------------------------------------------------------
// ROUTE: POST /api/verify-asset
// ---------------------------------------------------------------------------

router.post(
    '/verify-asset',
    upload.single('file'),
    async (req, res) => {
        // --- Input validation -----------------------------------------------
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded. Include a file field in multipart/form-data.',
            });
        }

        const { assetId, context } = req.body;

        if (!assetId || isNaN(parseInt(assetId, 10))) {
            return res.status(400).json({
                success: false,
                error: 'assetId (uint256 string) is required.',
            });
        }

        const assetIdNum = parseInt(assetId, 10);

        console.log(`\n🔍 Asset Verification Request: assetId=${assetIdNum}, file=${req.file.originalname} (${req.file.mimetype}, ${(req.file.size / 1024).toFixed(1)}KB)`);

        // --- Step 1: Validate asset exists on-chain -------------------------
        let assetOnChain;
        try {
            assetOnChain = await registryContract.getAsset(assetIdNum);
        } catch (chainErr) {
            return res.status(404).json({
                success: false,
                error: `Asset #${assetIdNum} not found in KulaPublicRegistry: ${chainErr.message}`,
            });
        }

        // --- Step 2: Upload to IPFS -----------------------------------------
        let ipfsCID;
        try {
            ipfsCID = await uploadToIPFS(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype,
            );
            console.log(`📌 IPFS upload successful: ${ipfsCID}`);
        } catch (ipfsErr) {
            console.error('IPFS upload error:', ipfsErr);
            return res.status(502).json({
                success: false,
                error: `IPFS upload failed: ${ipfsErr.message}`,
                step: 'ipfs_upload',
            });
        }

        // --- Step 3: OpenAI gpt-4o Vision analysis --------------------------
        let analysisResult;
        try {
            const dataUrl  = bufferToDataUrl(req.file.buffer, req.file.mimetype);
            const messages = buildAssetVisionMessages(dataUrl, context || '');

            const completion = await openai.chat.completions.create({
                ...OPENAI_CALL_OPTIONS,
                messages,
            });

            const rawContent = completion.choices?.[0]?.message?.content || '';
            console.log(`🤖 OpenAI raw response (first 300 chars): ${rawContent.slice(0, 300)}`);

            analysisResult = parseVisionResponse(rawContent);

            console.log(`📊 Analysis result: authenticity=${analysisResult.document_authenticity_score}, type=${analysisResult.asset_type}, owner="${analysisResult.owner}"`);
        } catch (aiErr) {
            console.error('OpenAI vision error:', aiErr);
            return res.status(502).json({
                success: false,
                error: `AI analysis failed: ${aiErr.message}`,
                step: 'ai_analysis',
                ipfsCID, // Return CID anyway so the upload isn't wasted
            });
        }

        // --- Step 4: Compute asset hash -------------------------------------
        const assetHash = computeAssetHash(req.file.buffer);
        console.log(`🔑 Asset hash: ${assetHash}`);

        // --- Step 5: Conditional on-chain verification ----------------------
        let txHash      = null;
        let autoVerified = false;
        const meetsThreshold = analysisResult.document_authenticity_score > AUTHENTICITY_THRESHOLD;

        if (meetsThreshold) {
            console.log(`✅ Score ${analysisResult.document_authenticity_score} > ${AUTHENTICITY_THRESHOLD} — triggering on-chain verification`);
            try {
                const receipt = await triggerOnChainVerification(assetHash, ipfsCID);
                txHash       = receipt.hash;
                autoVerified = true;
            } catch (chainErr) {
                console.error('On-chain verify() error:', chainErr);
                // Non-fatal: the oracle wallet may be out of gas or the contract call
                // failed for a recoverable reason. Return the analysis result anyway
                // and flag the tx failure so the operator can retry manually.
                analysisResult.extraction_notes +=
                    ` | WARNING: On-chain verification TX failed: ${chainErr.message}`;
            }
        } else {
            console.log(`⚠️ Score ${analysisResult.document_authenticity_score} ≤ ${AUTHENTICITY_THRESHOLD} — queued for community review`);
        }

        // --- Step 6: Persist to DB ------------------------------------------
        await recordVerificationResult({
            assetId: assetIdNum,
            ipfsCID,
            assetHash,
            analysisResult,
            txHash,
            autoVerified,
        });

        // --- Step 7: Respond ------------------------------------------------
        return res.status(200).json({
            success:      true,
            assetId:      assetIdNum,
            ipfsCID,
            assetHash,
            autoVerified,
            txHash,
            meetsThreshold,
            threshold:    AUTHENTICITY_THRESHOLD,
            analysis:     analysisResult,
        });
    },
);

// ---------------------------------------------------------------------------
// MULTER ERROR HANDLER (must have 4 params to be recognised by Express)
// ---------------------------------------------------------------------------

router.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
            ? 'File too large. Maximum size is 10MB.'
            : err.message;
        return res.status(400).json({ success: false, error: msg, step: 'upload' });
    }

    if (err) {
        return res.status(400).json({ success: false, error: err.message, step: 'upload' });
    }
});

module.exports = router;
