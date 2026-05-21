// =============================================================================
// FILE: backend/prompts/assetVisionPrompt.js
// PURPOSE: Phase 4 – Kula Oracle AI Agent
//
// Provides the system prompt used to instruct gpt-4o-vision to analyze
// Real World Asset (RWA) documents (deeds, logbooks, title certificates)
// and return a STRICT JSON object — no prose, no markdown fences, no
// preamble — suitable for direct JSON.parse() in the calling route.
//
// OUTPUT CONTRACT (all fields required):
// {
//   "owner":                    string,   // Full legal name of the registered owner
//   "asset_type":               string,   // "land_deed" | "vehicle_logbook" | "title_certificate" | "unknown"
//   "estimated_value":          number,   // Numeric USD estimate; 0 if undeterminable
//   "currency":                 string,   // ISO 4217 code of the document's currency (default "USD")
//   "document_authenticity_score": number, // 0.00–1.00 float (1.0 = fully authentic)
//   "confidence":               number,   // 0.00–1.00 float (overall extraction confidence)
//   "document_number":          string,   // LR No., Chassis No., Registration No., etc. (or "UNKNOWN")
//   "issuing_authority":        string,   // Government body, land registry, NTSA, etc. (or "UNKNOWN")
//   "issue_date":               string,   // ISO 8601 date string or "UNKNOWN"
//   "location":                 string,   // Plot location, county, or registered address (or "UNKNOWN")
//   "red_flags":                string[],  // Array of authenticity concerns; [] if none
//   "extraction_notes":         string    // Brief analyst note on quality / limitations
// }
//
// ORACLE THRESHOLD: document_authenticity_score > 0.85 triggers on-chain
//   KulaPublicRegistry.verify(assetHash, ipfsCID) via the Oracle Wallet.
//   Scores ≤ 0.85 are flagged for manual community review.
// =============================================================================

'use strict';

/**
 * The system prompt passed to the OpenAI gpt-4o vision endpoint.
 *
 * Design principles:
 *   1. JSON-mode enforced: the model is instructed to output ONLY the JSON
 *      object, with no surrounding text, codeblocks, or commentary.
 *   2. Field definitions are exhaustive so the model never omits a key.
 *   3. Authenticity scoring rubric is explicit to prevent hallucination.
 *   4. "Strict JSON" phrasing appears both in the system role and at the end
 *      of the instructions — reinforcing compliance across attention layers.
 */
const ASSET_VISION_SYSTEM_PROMPT = `
You are the Kula Oracle, an AI analyst specializing in Real World Asset (RWA) document verification for African emerging markets. You have deep expertise in Kenyan land title deeds (LR Numbers, Registry Index Maps), vehicle logbooks (NTSA Kenya), and other government-issued ownership certificates across East Africa.

Your task is to analyze the provided document image and extract structured ownership and authenticity data.

OUTPUT REQUIREMENTS — CRITICAL:
- You MUST respond with ONLY a single, valid JSON object.
- Do NOT include any markdown code fences (no \`\`\`json or \`\`\`).
- Do NOT include any preamble, explanation, commentary, or trailing text.
- Every key listed below MUST be present in the output, even if the value is "UNKNOWN" or 0.
- The response must be directly parseable by JSON.parse() with zero pre-processing.

JSON SCHEMA (output exactly this structure):
{
  "owner": "<string: Full legal name of the registered owner as it appears on the document. Use 'UNKNOWN' if illegible.>",
  "asset_type": "<string: One of: 'land_deed', 'vehicle_logbook', 'title_certificate', 'lease_agreement', 'other', 'unknown'>",
  "estimated_value": <number: Best numeric USD estimate of the asset's market value. Use 0 if not determinable. Do NOT include currency symbols.>,
  "currency": "<string: ISO 4217 code of any monetary value on the document, e.g. 'KES', 'USD', 'UGX'. Default 'USD' if absent.>",
  "document_authenticity_score": <number: Float between 0.00 and 1.00. See scoring rubric below.>,
  "confidence": <number: Float between 0.00 and 1.00. Your overall confidence in the extraction accuracy.>,
  "document_number": "<string: The primary document identifier (LR No., Chassis No., Registration Plate, Title No., etc.). Use 'UNKNOWN' if absent.>",
  "issuing_authority": "<string: The government body or registry that issued the document (e.g. 'Ministry of Lands Kenya', 'NTSA', 'Nairobi City County'). Use 'UNKNOWN' if absent.>",
  "issue_date": "<string: ISO 8601 date of issue (YYYY-MM-DD). Use 'UNKNOWN' if absent or illegible.>",
  "location": "<string: Plot location, county, sub-county, registered postal address, or vehicle region. Use 'UNKNOWN' if absent.>",
  "red_flags": [<string array: Each element is a specific authenticity concern, e.g. 'Mismatched fonts detected', 'Official seal appears digitally altered', 'Serial number format inconsistent with issuing authority standards', 'Document appears to be a photocopy without original stamp'. Return [] if no concerns.>],
  "extraction_notes": "<string: One to three sentences summarizing document quality, limitations, or notable observations for the human reviewer.>"
}

AUTHENTICITY SCORING RUBRIC (document_authenticity_score):
- 0.90–1.00: All security features visible (watermarks, embossed seals, official stamps), consistent fonts, correct government letterhead, serial numbers match known formats, no signs of alteration.
- 0.75–0.89: Most features present, minor inconsistencies (e.g. faded stamp, partial watermark visible), no obvious tampering.
- 0.50–0.74: Some features missing or unclear, document may be a photocopy, format partially consistent. Requires manual review.
- 0.25–0.49: Significant concerns: missing official markings, altered sections, inconsistent numbering, suspicious formatting.
- 0.00–0.24: High likelihood of forgery: multiple red flags, completely inconsistent with known authentic document formats, obvious digital manipulation.

IMPORTANT NOTES:
- If the image is blurry, low-resolution, or partially obscured, lower both confidence and document_authenticity_score accordingly and note this in extraction_notes.
- If no document is detected in the image (e.g. a blank image or non-document photo), set asset_type to 'unknown', document_authenticity_score to 0, confidence to 0, and note this in extraction_notes.
- Never fabricate document numbers, owner names, or dates. Use 'UNKNOWN' for any field you cannot read.
- Your response is fed directly into a smart contract verification pipeline. Accuracy and strict JSON compliance are paramount.

Respond with ONLY the JSON object. No other text.
`.trim();

/**
 * Builds the messages array for the OpenAI Chat Completions API
 * with vision support (gpt-4o).
 *
 * The image is passed as a base64 data URL or an IPFS/HTTP URL.
 *
 * @param {string} imageUrl  — https:// or data:image/jpeg;base64,... URL
 * @param {string} [context] — Optional human-readable context (e.g. "Kenyan land deed from Kiambu County")
 * @returns {object[]}       — OpenAI messages array ready for api.chat.completions.create()
 */
function buildAssetVisionMessages(imageUrl, context = '') {
    const userText = context
        ? `Document type hint: ${context}. Analyze this document and return the JSON object as instructed.`
        : 'Analyze this document and return the JSON object as instructed.';

    return [
        {
            role: 'system',
            content: ASSET_VISION_SYSTEM_PROMPT,
        },
        {
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: {
                        url:    imageUrl,
                        detail: 'high', // Use high detail for small text on documents
                    },
                },
                {
                    type: 'text',
                    text: userText,
                },
            ],
        },
    ];
}

/**
 * Parses the raw OpenAI response string into the expected JSON object.
 * Strips any accidental markdown fences before parsing.
 *
 * Throws if parsing fails — the caller (verifyAsset.js) must handle this.
 *
 * @param {string} rawContent  — The text content from data.choices[0].message.content
 * @returns {object}           — Parsed asset analysis object
 */
function parseVisionResponse(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') {
        throw new Error('OpenAI returned empty or non-string content');
    }

    // Strip markdown fences if the model ignored instructions
    const cleaned = rawContent
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/,           '')
        .trim();

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (parseErr) {
        throw new Error(`Failed to parse OpenAI vision response as JSON: ${parseErr.message}\nRaw: ${cleaned.slice(0, 300)}`);
    }

    // Validate required fields
    const REQUIRED_FIELDS = [
        'owner',
        'asset_type',
        'estimated_value',
        'currency',
        'document_authenticity_score',
        'confidence',
        'document_number',
        'issuing_authority',
        'issue_date',
        'location',
        'red_flags',
        'extraction_notes',
    ];

    const missingFields = REQUIRED_FIELDS.filter(f => !(f in parsed));
    if (missingFields.length > 0) {
        throw new Error(`OpenAI response missing required fields: ${missingFields.join(', ')}`);
    }

    // Type coercions for robustness
    parsed.document_authenticity_score = Number(parsed.document_authenticity_score);
    parsed.confidence                  = Number(parsed.confidence);
    parsed.estimated_value             = Number(parsed.estimated_value);

    if (!Array.isArray(parsed.red_flags)) {
        parsed.red_flags = [];
    }

    return parsed;
}

/**
 * OpenAI API call configuration for gpt-4o vision in JSON mode.
 * Pass these options to openai.chat.completions.create().
 */
const OPENAI_CALL_OPTIONS = {
    model:       'gpt-4o',
    max_tokens:  1000,
    temperature: 0,        // Deterministic output — essential for document parsing
    response_format: { type: 'json_object' }, // Enforces JSON output at the API level
};

module.exports = {
    ASSET_VISION_SYSTEM_PROMPT,
    buildAssetVisionMessages,
    parseVisionResponse,
    OPENAI_CALL_OPTIONS,
};
