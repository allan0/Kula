// =============================================================================
// FILE: ussd-middleware/telegramBot.js
// PURPOSE: Production Kula Telegram Bot (Phase 3 – TMA Super-App Auth)
//
// COMMANDS:
//   /kula_join  — Registers the user in the DB (by tg_id), then generates a
//                 cryptographically signed deep-link URL to the Kula TMA.
//                 The payload is HMAC-SHA256 signed with TG_DEEPLINK_SECRET
//                 so the frontend can verify it was issued by this server,
//                 preventing spoofing/replay attacks.
//   /status     — Shows the user's on-chain identity, account status, and
//                 active group subscriptions from group_notification_subscriptions.
//   /subscribe <groupId>  — Subscribes the chat to on-chain events for a group.
//   /unsubscribe <groupId> — Removes a subscription.
//
// SECURITY MODEL:
//   Deep-link payload:  base64url({ tg_id, tg_username, ts })
//   Signature:          HMAC-SHA256(payload, TG_DEEPLINK_SECRET)
//   URL:                https://<WEBAPP_URL>/?tgAuth=<payload>.<sig>
//
//   The TelegramProvider on the frontend verifies this signature before
//   bypassing the standard Connect-Wallet flow and minting the Smart Account.
//
// DEPENDENCIES (add to ussd-middleware/package.json):
//   "telegraf": "^4.16.3"
//   "pg": "^8.11.5"
//
// ENV VARS REQUIRED:
//   TELEGRAM_BOT_TOKEN       — BotFather token
//   TG_DEEPLINK_SECRET       — Random ≥32-byte hex secret for HMAC signing
//   WEBAPP_URL               — https://kula-six.vercel.app (or your TMA URL)
//   DATABASE_URL             — PostgreSQL connection string (same as server.js)
//   ROTARY_GROUP_CONTRACT    — Deployed RotaryGroup address
//   BASE_SEPOLIA_RPC         — Base Sepolia JSON-RPC
//   KULA_SALT_SECRET         — Salt for deterministic Smart Account derivation
//   SIMPLE_ACCOUNT_FACTORY   — ERC-4337 factory address
// =============================================================================

'use strict';

const { Telegraf, Markup }  = require('telegraf');
const { message }           = require('telegraf/filters');
const { Pool }              = require('pg');
const { ethers }            = require('ethers');
const crypto                = require('crypto');
require('dotenv').config();

// ---------------------------------------------------------------------------
// ENV VALIDATION
// ---------------------------------------------------------------------------

const REQUIRED_ENV = [
    'TELEGRAM_BOT_TOKEN',
    'TG_DEEPLINK_SECRET',
    'WEBAPP_URL',
    'DATABASE_URL',
    'KULA_SALT_SECRET',
    'SIMPLE_ACCOUNT_FACTORY',
    'BASE_SEPOLIA_RPC',
    'ROTARY_GROUP_CONTRACT',
];

const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error('❌ telegramBot.js: missing env vars:', missing.join(', '));
    process.exit(1);
}

// ---------------------------------------------------------------------------
// INFRASTRUCTURE
// ---------------------------------------------------------------------------

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const db  = new Pool({ connectionString: process.env.DATABASE_URL });

const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);

const FACTORY_ABI = [
    'function getAddress(address owner, uint256 salt) external view returns (address)',
];
const factoryContract = new ethers.Contract(
    process.env.SIMPLE_ACCOUNT_FACTORY,
    FACTORY_ABI,
    provider,
);

const ROTARY_GROUP_ABI = [
    'function groupCount() external view returns (uint256)',
    'function groups(uint256) external view returns (uint256,string,address,uint256,uint256,uint256,uint256,uint256,uint256,bool)',
    'function isMember(uint256, address) external view returns (bool)',
];
const rotaryContract = new ethers.Contract(
    process.env.ROTARY_GROUP_CONTRACT,
    ROTARY_GROUP_ABI,
    provider,
);

// ---------------------------------------------------------------------------
// HELPERS — Deterministic Smart Account derivation (mirrors server.js)
// ---------------------------------------------------------------------------

/**
 * Re-derives the owner EOA and Smart Account address from a Telegram ID.
 * We use tg_id (string) as the "phone-equivalent" seed for web/TMA users.
 * The same KULA_SALT_SECRET ensures cross-channel consistency.
 *
 * @param {string|number} tgId
 * @returns {{ ownerEOA: string, smartAccountAddress: Promise<string>, salt: string }}
 */
function deriveTgIdentity(tgId) {
    const seed = String(tgId);

    const innerHash = ethers.keccak256(ethers.toUtf8Bytes(seed));
    const privateKey = ethers.keccak256(
        ethers.concat([
            ethers.getBytes(innerHash),
            ethers.toUtf8Bytes(process.env.KULA_SALT_SECRET),
        ]),
    );

    const wallet   = new ethers.Wallet(privateKey);
    const salt     = ethers.keccak256(
        ethers.concat([
            ethers.toUtf8Bytes(seed),
            ethers.toUtf8Bytes(process.env.KULA_SALT_SECRET),
        ]),
    );
    const saltUint = BigInt(salt);

    return { ownerEOA: wallet.address, salt, saltUint };
}

async function deriveSmartAccountForTg(tgId) {
    const { ownerEOA, salt, saltUint } = deriveTgIdentity(tgId);
    const smartAccountAddress = await factoryContract.getAddress(ownerEOA, saltUint);
    return { ownerEOA, smartAccountAddress, salt };
}

// ---------------------------------------------------------------------------
// DEEP-LINK SIGNING
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically signed deep-link URL for the Kula TMA.
 *
 * Payload schema (JSON, then base64url encoded):
 *   { tg_id, tg_username, ts }           ← ts = Unix seconds (for expiry check)
 *
 * Signature:
 *   HMAC-SHA256(base64url(payload), TG_DEEPLINK_SECRET)   → hex
 *
 * Final URL:
 *   https://<WEBAPP_URL>/?tgAuth=<payload>.<signature>
 *
 * The TelegramProvider on the frontend splits on ".", re-derives the HMAC,
 * and compares it in constant time before trusting the identity.
 *
 * @param {number|string} tgId
 * @param {string}        tgUsername
 * @returns {string}      Signed deep-link URL
 */
function generateSignedDeepLink(tgId, tgUsername) {
    const payloadObj = {
        tg_id:       String(tgId),
        tg_username: tgUsername || '',
        ts:          Math.floor(Date.now() / 1000),
    };

    const payloadJson   = JSON.stringify(payloadObj);
    const payloadB64    = Buffer.from(payloadJson).toString('base64url');

    const signature = crypto
        .createHmac('sha256', process.env.TG_DEEPLINK_SECRET)
        .update(payloadB64)
        .digest('hex');

    const tgAuth = `${payloadB64}.${signature}`;

    const webAppUrl = process.env.WEBAPP_URL.replace(/\/$/, '');
    return `${webAppUrl}/?tgAuth=${encodeURIComponent(tgAuth)}`;
}

// ---------------------------------------------------------------------------
// DB HELPERS
// ---------------------------------------------------------------------------

/**
 * Upserts a Telegram user into the `users` table.
 * Sets onboarding_channel = 'TELEGRAM' if the row is new.
 * Returns the full user row.
 */
async function upsertTelegramUser(tgId, tgUsername, displayName, smartAccountAddress, ownerEOA, salt) {
    const { rows } = await db.query(
        `INSERT INTO users (
            smart_account_address,
            tg_id,
            tg_username,
            display_name,
            owner_eoa,
            derivation_salt,
            onboarding_channel,
            account_status,
            reputation_score
        ) VALUES ($1, $2, $3, $4, $5, $6, 'TELEGRAM', 'PENDING', 50)
        ON CONFLICT (tg_id) DO UPDATE
            SET tg_username  = EXCLUDED.tg_username,
                display_name = COALESCE(EXCLUDED.display_name, users.display_name),
                updated_at   = NOW()
        RETURNING *`,
        [
            smartAccountAddress,
            String(tgId),
            tgUsername  || null,
            displayName || null,
            ownerEOA,
            salt,
        ],
    );
    return rows[0];
}

/**
 * Looks up a user by tg_id. Returns null if not found.
 */
async function getUserByTgId(tgId) {
    const { rows } = await db.query(
        'SELECT * FROM users WHERE tg_id = $1',
        [String(tgId)],
    );
    return rows[0] || null;
}

/**
 * Returns all group_notification_subscriptions rows for a given tg_chat_id.
 */
async function getSubscriptionsForChat(chatId) {
    const { rows } = await db.query(
        `SELECT gns.group_id, gns.subscribed_at, gns.notify_contributions, gns.notify_payouts
           FROM group_notification_subscriptions gns
          WHERE gns.tg_chat_id = $1
          ORDER BY gns.group_id ASC`,
        [String(chatId)],
    );
    return rows;
}

/**
 * Upserts a subscription row for (tg_chat_id, group_id).
 */
async function upsertSubscription(chatId, groupId) {
    await db.query(
        `INSERT INTO group_notification_subscriptions (tg_chat_id, group_id, subscribed_at, notify_contributions, notify_payouts)
         VALUES ($1, $2, NOW(), true, true)
         ON CONFLICT (tg_chat_id, group_id) DO UPDATE
             SET notify_contributions = true,
                 notify_payouts = true,
                 subscribed_at = NOW()`,
        [String(chatId), groupId],
    );
}

/**
 * Removes a subscription row.
 */
async function removeSubscription(chatId, groupId) {
    const { rowCount } = await db.query(
        `DELETE FROM group_notification_subscriptions
          WHERE tg_chat_id = $1 AND group_id = $2`,
        [String(chatId), groupId],
    );
    return rowCount > 0;
}

// ---------------------------------------------------------------------------
// COMMAND: /start
// ---------------------------------------------------------------------------

bot.start(async (ctx) => {
    const { id: tgId, first_name, username } = ctx.from;
    const displayName = first_name || username || 'Kula Member';

    // The startPayload captures any ?start= parameter sent via a deep link
    // (e.g. t.me/KulaBot?start=referral_abc). We store it for referral tracking.
    const startPayload = ctx.startPayload || null;

    try {
        const { ownerEOA, smartAccountAddress, salt } = await deriveSmartAccountForTg(tgId);

        await upsertTelegramUser(tgId, username, displayName, smartAccountAddress, ownerEOA, salt);

        const deepLink = generateSignedDeepLink(tgId, username);

        await ctx.replyWithMarkdownV2(
            `*Welcome to the KULA Vault, ${escapeMarkdown(displayName)}\\!* 🏦\n\n` +
            `Your sovereign Smart Account has been initialized on Base L2\\.\n\n` +
            `*Account:* \`${escapeMarkdown(smartAccountAddress.slice(0, 8))}\\.\\.\\.\`\n` +
            `*Trust Score:* *50 / 100* \\(Neutral\\)\n\n` +
            `Use /kula\\_join to open the full Vault app, or /status to check your on\\-chain position\\.`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('🏛 Open KULA Vault', deepLink)],
                [Markup.button.callback('📊 Check Status', 'cb_status')],
            ]),
        );

        console.log(`👤 /start: tg_id=${tgId} → smartAccount=${smartAccountAddress} payload="${startPayload}"`);
    } catch (err) {
        console.error('/start error:', err);
        await ctx.reply('⚠️ Error initializing your vault. Please try again in a moment.');
    }
});

// ---------------------------------------------------------------------------
// COMMAND: /kula_join
// ---------------------------------------------------------------------------
// 1. Ensures the user exists in the DB (creates if new).
// 2. Generates a HMAC-signed deep-link URL for the TMA.
// 3. Replies with a Web App button that opens the signed URL.
// ---------------------------------------------------------------------------

bot.command('kula_join', async (ctx) => {
    const { id: tgId, first_name, username } = ctx.from;
    const displayName = first_name || username || 'Member';

    try {
        const { ownerEOA, smartAccountAddress, salt } = await deriveSmartAccountForTg(tgId);
        await upsertTelegramUser(tgId, username, displayName, smartAccountAddress, ownerEOA, salt);

        const deepLink = generateSignedDeepLink(tgId, username);

        // Check on-chain deployment status
        const code      = await provider.getCode(smartAccountAddress);
        const isLive    = code !== '0x';
        const statusBadge = isLive ? '🟢 DEPLOYED' : '🟡 COUNTERFACTUAL';

        await ctx.replyWithMarkdownV2(
            `*KULA Vault Access Granted* ✅\n\n` +
            `*Smart Account:*\n\`${escapeMarkdown(smartAccountAddress)}\`\n` +
            `*Chain Status:* ${statusBadge}\n\n` +
            `Your session token is valid for *15 minutes*\\. Tap the button below to enter the Vault\\.`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('🚀 Enter KULA Vault', deepLink)],
            ]),
        );

        console.log(`🔑 /kula_join: tg_id=${tgId} deepLink=${deepLink}`);
    } catch (err) {
        console.error('/kula_join error:', err);
        await ctx.reply('⚠️ Unable to generate your access token. Please try again.');
    }
});

// ---------------------------------------------------------------------------
// COMMAND: /status
// ---------------------------------------------------------------------------
// Shows the user's DB record, Smart Account address, reputation score, and
// all active group_notification_subscriptions for this chat.
// ---------------------------------------------------------------------------

bot.command('status', async (ctx) => {
    const { id: tgId } = ctx.from;

    try {
        const user = await getUserByTgId(tgId);

        if (!user) {
            return ctx.reply(
                '❌ You are not registered yet.\n\nRun /kula_join to initialize your Kula Vault.',
            );
        }

        // Check live on-chain status
        const code      = await provider.getCode(user.smart_account_address);
        const isDeployed = code !== '0x';
        const statusStr  = isDeployed ? '🟢 DEPLOYED' : '🟡 PENDING DEPLOYMENT';

        // Fetch USDC balance
        const usdcAbi = ['function balanceOf(address) external view returns (uint256)'];
        const usdcAddr = process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
        const usdc     = new ethers.Contract(usdcAddr, usdcAbi, provider);
        let balanceStr = 'N/A';
        try {
            const raw = await usdc.balanceOf(user.smart_account_address);
            balanceStr = `${ethers.formatUnits(raw, 6)} USDC`;
        } catch (_) { /* RPC error — show N/A */ }

        // Fetch subscriptions
        const subs = await getSubscriptionsForChat(ctx.chat.id);
        const subLines = subs.length > 0
            ? subs.map(s => `  • Group #${s.group_id}`).join('\n')
            : '  None';

        // Fetch recent pending user ops
        const opsResult = await db.query(
            `SELECT operation_type, status, submitted_at
               FROM user_operations
              WHERE smart_account_address = $1
              ORDER BY created_at DESC
              LIMIT 3`,
            [user.smart_account_address],
        );
        const opLines = opsResult.rows.length > 0
            ? opsResult.rows.map(op =>
                `  • ${op.operation_type} — ${op.status} (${new Date(op.submitted_at).toLocaleString()})`
              ).join('\n')
            : '  None';

        const shortAddr = `${user.smart_account_address.slice(0, 8)}...${user.smart_account_address.slice(-6)}`;

        await ctx.replyWithMarkdownV2(
            `*KULA Status Report* 📊\n\n` +
            `*Smart Account:* \`${escapeMarkdown(shortAddr)}\`\n` +
            `*Chain Status:* ${escapeMarkdown(statusStr)}\n` +
            `*USDC Balance:* ${escapeMarkdown(balanceStr)}\n` +
            `*Reputation:* ${user.reputation_score}/100 \\(${escapeMarkdown(user.reputation_tier || 'New')})\\)\n` +
            `*Channel:* ${escapeMarkdown(user.onboarding_channel)}\n\n` +
            `*Active Group Subscriptions:*\n${escapeMarkdown(subLines)}\n\n` +
            `*Recent Transactions:*\n${escapeMarkdown(opLines)}`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Refresh', 'cb_status')],
            ]),
        );
    } catch (err) {
        console.error('/status error:', err);
        await ctx.reply('⚠️ Error fetching your status. Please try again.');
    }
});

// ---------------------------------------------------------------------------
// COMMAND: /subscribe <groupId>
// ---------------------------------------------------------------------------
// Subscribes the current chat to on-chain event notifications for a group.
// Requires the group to exist in RotaryGroup.
// ---------------------------------------------------------------------------

bot.command('subscribe', async (ctx) => {
    const args    = ctx.message.text.split(' ').slice(1);
    const groupId = parseInt(args[0], 10);

    if (isNaN(groupId) || groupId < 1) {
        return ctx.reply('Usage: /subscribe <groupId>\nExample: /subscribe 1');
    }

    try {
        // Validate group exists
        const groupCount = await rotaryContract.groupCount();
        if (BigInt(groupId) > groupCount) {
            return ctx.reply(`❌ Group #${groupId} does not exist on-chain.`);
        }

        const groupData = await rotaryContract.groups(groupId);
        const groupName = groupData[1];

        await upsertSubscription(ctx.chat.id, groupId);

        await ctx.replyWithMarkdownV2(
            `✅ *Subscribed to Group #${groupId}*\n\n` +
            `*Circle Name:* ${escapeMarkdown(groupName)}\n\n` +
            `This chat will now receive notifications for:\n` +
            `  • 💰 New contributions\n` +
            `  • 🏆 Payout executions\n` +
            `  • 📋 New governance proposals\n\n` +
            `Use /unsubscribe ${groupId} to remove\\.`,
        );

        console.log(`📩 /subscribe: chat=${ctx.chat.id} → group=${groupId}`);
    } catch (err) {
        console.error('/subscribe error:', err);
        await ctx.reply('⚠️ Error subscribing. Please try again.');
    }
});

// ---------------------------------------------------------------------------
// COMMAND: /unsubscribe <groupId>
// ---------------------------------------------------------------------------

bot.command('unsubscribe', async (ctx) => {
    const args    = ctx.message.text.split(' ').slice(1);
    const groupId = parseInt(args[0], 10);

    if (isNaN(groupId) || groupId < 1) {
        return ctx.reply('Usage: /unsubscribe <groupId>\nExample: /unsubscribe 1');
    }

    try {
        const removed = await removeSubscription(ctx.chat.id, groupId);

        if (removed) {
            await ctx.reply(`✅ Unsubscribed from Group #${groupId}. You will no longer receive notifications.`);
        } else {
            await ctx.reply(`ℹ️ No active subscription found for Group #${groupId}.`);
        }
    } catch (err) {
        console.error('/unsubscribe error:', err);
        await ctx.reply('⚠️ Error unsubscribing. Please try again.');
    }
});

// ---------------------------------------------------------------------------
// CALLBACK QUERIES
// ---------------------------------------------------------------------------

bot.action('cb_status', async (ctx) => {
    await ctx.answerCbQuery('Refreshing…');
    // Simulate /status by re-invoking the handler logic via a fake message
    ctx.message = ctx.callbackQuery.message;
    ctx.from    = ctx.callbackQuery.from;

    const { id: tgId } = ctx.from;
    try {
        const user = await getUserByTgId(tgId);
        if (!user) {
            return ctx.editMessageText('❌ Not registered. Use /kula_join to initialize.');
        }

        const deepLink = generateSignedDeepLink(tgId, ctx.from.username);
        const shortAddr = `${user.smart_account_address.slice(0, 8)}...${user.smart_account_address.slice(-6)}`;

        await ctx.editMessageText(
            `📊 Status for ${ctx.from.first_name}\n\n` +
            `Smart Account: ${shortAddr}\n` +
            `Reputation: ${user.reputation_score}/100\n` +
            `Channel: ${user.onboarding_channel}`,
            Markup.inlineKeyboard([
                [Markup.button.webApp('🏛 Open Vault', deepLink)],
                [Markup.button.callback('🔄 Refresh', 'cb_status')],
            ]),
        );
    } catch (err) {
        console.error('cb_status error:', err);
        await ctx.answerCbQuery('Error refreshing status.');
    }
});

// ---------------------------------------------------------------------------
// EXPORTED NOTIFICATION UTILITY
// ---------------------------------------------------------------------------
// Called by the event listener (eventListener.js) when an on-chain event fires.
// Fetches all subscribed chat IDs for the group and broadcasts the message.

/**
 * Notifies all Telegram chats subscribed to _groupId.
 *
 * @param {number|string} groupId
 * @param {string}        message   Plain text or MarkdownV2 string
 */
async function notifyGroupSubscribers(groupId, message) {
    try {
        const { rows } = await db.query(
            `SELECT tg_chat_id FROM group_notification_subscriptions
              WHERE group_id = $1`,
            [groupId],
        );

        for (const { tg_chat_id } of rows) {
            try {
                await bot.telegram.sendMessage(tg_chat_id, message);
            } catch (sendErr) {
                // Bot may have been blocked — log and continue
                console.warn(`⚠️ Failed to notify chat ${tg_chat_id}:`, sendErr.message);
            }
        }
    } catch (err) {
        console.error('notifyGroupSubscribers error:', err);
    }
}

// ---------------------------------------------------------------------------
// UTILITY: Escape MarkdownV2 special characters
// ---------------------------------------------------------------------------

function escapeMarkdown(text) {
    if (!text) return '';
    return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

// ---------------------------------------------------------------------------
// ERROR HANDLING
// ---------------------------------------------------------------------------

bot.catch((err, ctx) => {
    console.error(`Telegraf error for update ${ctx.updateType}:`, err);
});

// ---------------------------------------------------------------------------
// LAUNCH
// ---------------------------------------------------------------------------

bot.launch({
    // Use webhook in production (set WEBHOOK_URL and PORT env vars)
    // For local dev, long-polling is used automatically when WEBHOOK_URL is absent.
    ...(process.env.WEBHOOK_URL && {
        webhook: {
            domain: process.env.WEBHOOK_URL,
            port:   parseInt(process.env.PORT || '3001', 10),
        },
    }),
}).then(() => {
    console.log('🤖 KULA Telegram Bot is live');
    console.log(`   WebApp URL: ${process.env.WEBAPP_URL}`);
    console.log(`   Mode:       ${process.env.WEBHOOK_URL ? 'Webhook' : 'Long-polling'}`);
});

// Graceful shutdown
process.once('SIGINT',  () => { bot.stop('SIGINT');  db.end(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); db.end(); });

module.exports = { bot, generateSignedDeepLink, notifyGroupSubscribers };
