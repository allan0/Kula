// =============================================================================
// FILE: ussd-middleware/listener.js
// PURPOSE: Standalone on-chain event listener. Subscribes to RotaryGroup and
//          KulaGovernance events on Base Sepolia, queries the DB for affected
//          group members' Telegram subscriptions, and dispatches notifications
//          via the Telegraf bot.
//
// EVENTS HANDLED:
//   RotaryGroup:
//     ContributionReceived(groupId, member, amount, timestamp)
//     PayoutExecuted(groupId, recipient, amount)
//     MemberJoined(groupId, member)
//     LiquidityOptimized(groupId, amountSent)
//     AssetProposed(proposalId, groupId, registryAssetId)
//     JoinRequestSubmitted(groupId, applicant)
//     ReputationUpdated(member, newScore)
//
//   KulaGovernance:
//     ProposalCreated(proposalId, proposalType, groupId, proposer, amount, deadline)
//     VoteCast(proposalId, voter, support, currentVotesFor, currentVotesAgainst)
//     ProposalExecuted(proposalId, proposalType, recipient, amount)
//
// ARCHITECTURE:
//   ① Uses ethers.js WebSocketProvider for real-time event streaming.
//      Falls back to polling (JsonRpcProvider + contract.queryFilter) on
//      RPC endpoints that do not support WebSocket.
//   ② All DB queries go to the same PostgreSQL pool used by server.js.
//      Tables used: users, group_notification_subscriptions, user_operations,
//                   event_log (insert-only audit trail).
//   ③ Telegram notifications sent via Telegraf Bot API — no webhook needed.
//   ④ Auto-reconnects on WebSocket disconnect (exponential back-off, max 5 min).
//   ⑤ Process-level error handling prevents silent crashes.
//
// RUNNING:
//   node ussd-middleware/listener.js
//   (run alongside server.js — separate process or same Render service via npm-run-all)
//
// REQUIRED ENV (inherits from server.js .env):
//   BASE_SEPOLIA_RPC         — wss:// preferred, https:// supported (polling fallback)
//   BASE_SEPOLIA_WSS         — Optional dedicated WebSocket URL (Alchemy/QuickNode)
//   ROTARY_GROUP_CONTRACT    — Deployed RotaryGroup address
//   GOVERNANCE_CONTRACT      — Deployed KulaGovernance address
//   DATABASE_URL             — PostgreSQL connection string
//   TELEGRAM_BOT_TOKEN       — Telegraf bot token (from @BotFather)
//   LISTENER_START_BLOCK     — Optional: block number to replay from on first start
// =============================================================================

'use strict';

const { ethers }  = require('ethers');
const { Telegraf } = require('telegraf');
const { Pool }    = require('pg');
require('dotenv').config();

// =============================================================================
// SECTION 1 — ENVIRONMENT VALIDATION
// =============================================================================

const REQUIRED_ENV = [
    'BASE_SEPOLIA_RPC',
    'ROTARY_GROUP_CONTRACT',
    'DATABASE_URL',
    'TELEGRAM_BOT_TOKEN',
];

const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error('❌ listener.js: Missing required env vars:', missing.join(', '));
    process.exit(1);
}

// KulaGovernance is optional — listener degrades gracefully if not deployed yet
const GOVERNANCE_ADDRESS = process.env.GOVERNANCE_CONTRACT || null;

// =============================================================================
// SECTION 2 — CONSTANTS
// =============================================================================

const BASE_SEPOLIA_CHAIN_ID = 84532;

// USDC has 6 decimals on Base
const USDC_DECIMALS = 6;

// Reconnect back-off: starts at 5s, doubles each attempt, caps at 5 min
const RECONNECT_BASE_MS  = 5_000;
const RECONNECT_MAX_MS   = 300_000;
const RECONNECT_FACTOR   = 2;

// Block range for polling fallback (ethers queryFilter cap)
const POLL_BLOCK_RANGE = 2_000;

// How far back to look for missed events on startup (in blocks, ~2 hours on Base)
const CATCHUP_BLOCKS = 1_000;

// =============================================================================
// SECTION 3 — ABI FRAGMENTS
// =============================================================================

// Only the events we care about — keeps the filter set minimal
const ROTARY_GROUP_ABI = [
    // Core ROSCA events
    'event ContributionReceived(uint256 indexed groupId, address indexed member, uint256 amount, uint256 timestamp)',
    'event PayoutExecuted(uint256 indexed groupId, address indexed recipient, uint256 amount)',
    'event MemberJoined(uint256 indexed groupId, address indexed member)',
    'event LiquidityOptimized(uint256 indexed groupId, uint256 amountSent)',
    // Governance integration events
    'event AssetProposed(uint256 indexed proposalId, uint256 indexed groupId, uint256 registryAssetId)',
    'event JoinRequestSubmitted(uint256 indexed groupId, address indexed applicant)',
    'event ReputationUpdated(address indexed member, uint256 newScore)',
    // View functions for building notification context
    'function getMembers(uint256 _groupId) external view returns (address[])',
    'function groups(uint256) external view returns (uint256,string,address,uint256,uint256,uint256,uint256,uint256,uint256,bool)',
    'function getCurrentRecipient(uint256 _groupId) external view returns (address)',
];

const GOVERNANCE_ABI = [
    'event ProposalCreated(uint256 indexed proposalId, uint8 indexed proposalType, uint256 indexed groupId, address proposer, uint256 amount, uint256 deadline)',
    'event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 currentVotesFor, uint256 currentVotesAgainst)',
    'event ProposalExecuted(uint256 indexed proposalId, uint8 indexed proposalType, address indexed recipient, uint256 amount)',
    'function getProposal(uint256 _proposalId) external view returns (tuple(uint256 id, uint8 proposalType, string description, string documentHash, uint256 amount, address recipient, uint256 groupId, uint256 votesFor, uint256 votesAgainst, uint256 totalEligibleVoters, uint256 createdAt, uint256 deadline, bool executed, bool cancelled))',
];

// =============================================================================
// SECTION 4 — INFRASTRUCTURE
// =============================================================================

// PostgreSQL — same pool as server.js but in a separate process
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Telegraf bot — send-only (no webhook, no polling — listener just dispatches)
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Provider is initialised in startListener() after determining WS vs HTTP
let provider = null;
let rotaryGroup = null;
let governance = null;

// Track reconnect attempt count for back-off calculation
let reconnectAttempts = 0;

// Track the highest processed block to avoid reprocessing on reconnect
let lastProcessedBlock = 0;

// =============================================================================
// SECTION 5 — DATABASE HELPERS
// =============================================================================

/**
 * Returns all Telegram IDs subscribed to notifications for a given group.
 *
 * Queries group_notification_subscriptions joined against users to get tg_id.
 * Users without a linked Telegram account are silently excluded.
 *
 * Schema expected (from db/schema.sql):
 *   group_notification_subscriptions(
 *       id SERIAL PRIMARY KEY,
 *       group_id BIGINT NOT NULL,
 *       smart_account_address TEXT NOT NULL REFERENCES users(smart_account_address),
 *       notify_contributions BOOLEAN DEFAULT true,
 *       notify_payouts       BOOLEAN DEFAULT true,
 *       notify_proposals     BOOLEAN DEFAULT true,
 *       notify_votes         BOOLEAN DEFAULT false,
 *       created_at TIMESTAMPTZ DEFAULT NOW()
 *   )
 *
 * @param {number|bigint} groupId
 * @param {string} notificationType — 'contributions' | 'payouts' | 'proposals' | 'votes'
 * @returns {Promise<Array<{ tg_id: string, smart_account_address: string, display_name: string }>>}
 */
async function getSubscribers(groupId, notificationType) {
    const columnMap = {
        contributions: 'notify_contributions',
        payouts:       'notify_payouts',
        proposals:     'notify_proposals',
        votes:         'notify_votes',
    };

    const column = columnMap[notificationType] || 'notify_contributions';

    try {
        const result = await db.query(
            `SELECT u.tg_id, u.smart_account_address, u.display_name, u.reputation_tier
             FROM group_notification_subscriptions gns
             JOIN users u ON u.smart_account_address = gns.smart_account_address
             WHERE gns.group_id = $1
               AND gns.${column} = true
               AND u.tg_id IS NOT NULL`,
            [groupId.toString()]
        );
        return result.rows;
    } catch (err) {
        console.error(`DB getSubscribers error (group ${groupId}):`, err.message);
        return [];
    }
}

/**
 * Looks up a user by their on-chain address.
 * Used to enrich notifications with display names.
 *
 * @param {string} address — checksummed or lowercase address
 * @returns {Promise<{ tg_id: string|null, display_name: string|null } | null>}
 */
async function getUserByAddress(address) {
    try {
        const result = await db.query(
            `SELECT tg_id, display_name, reputation_score, reputation_tier
             FROM users
             WHERE smart_account_address = $1`,
            [address.toLowerCase()]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.error('DB getUserByAddress error:', err.message);
        return null;
    }
}

/**
 * Fetches group metadata from the database cache or falls back to on-chain read.
 * Returns the group name for use in notification messages.
 *
 * @param {number|bigint} groupId
 * @returns {Promise<string>} — group name or fallback "Circle #N"
 */
async function getGroupName(groupId) {
    try {
        // Try DB first (fast path)
        const result = await db.query(
            `SELECT group_name FROM rotary_groups WHERE on_chain_id = $1`,
            [groupId.toString()]
        );
        if (result.rows.length > 0) return result.rows[0].group_name;

        // Fallback: read from contract
        const groupData = await rotaryGroup.groups(groupId);
        const name = groupData[1]; // name is index 1 in the tuple
        return name || `Circle #${groupId}`;
    } catch (_) {
        return `Circle #${groupId}`;
    }
}

/**
 * Appends an event to the event_log table for audit purposes.
 * Non-critical — errors are swallowed to avoid disrupting the main flow.
 *
 * @param {string} eventName
 * @param {object} args       — Parsed event arguments
 * @param {string} txHash
 * @param {number} blockNumber
 */
async function logEvent(eventName, args, txHash, blockNumber) {
    try {
        await db.query(
            `INSERT INTO event_log (event_name, event_args, tx_hash, block_number, processed_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (tx_hash, event_name) DO NOTHING`,
            [eventName, JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v), txHash, blockNumber]
        );
    } catch (_) {
        // Non-critical — swallow silently
    }
}

// =============================================================================
// SECTION 6 — TELEGRAM DISPATCH HELPERS
// =============================================================================

/**
 * Sends a Telegram message to a single chat ID with error handling.
 * Uses HTML parse mode — escape user-supplied strings before passing to this function.
 *
 * @param {string} chatId   — Telegram user or group chat ID
 * @param {string} message  — HTML-formatted message text
 */
async function sendTelegram(chatId, message) {
    try {
        await bot.telegram.sendMessage(chatId, message, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        });
    } catch (err) {
        // 403 = user blocked bot, 400 = invalid chat_id — both are non-fatal
        if (err.code === 403 || err.code === 400) {
            console.warn(`⚠️  Cannot send to ${chatId}: ${err.description}`);
        } else {
            console.error(`Telegram send error to ${chatId}:`, err.message);
        }
    }
}

/**
 * Broadcasts a notification to all subscribers of a group for a given event type.
 * Each subscriber receives a personalised message (you vs. group member).
 *
 * @param {object} params
 * @param {number|bigint} params.groupId
 * @param {string}         params.notificationType — 'contributions' | 'payouts' | 'proposals' | 'votes'
 * @param {Function}       params.messageBuilder   — (subscriber) => string
 */
async function broadcastToGroup({ groupId, notificationType, messageBuilder }) {
    const subscribers = await getSubscribers(groupId, notificationType);

    if (subscribers.length === 0) {
        console.log(`📭 No subscribers for group ${groupId} (${notificationType})`);
        return;
    }

    console.log(`📢 Broadcasting to ${subscribers.length} subscriber(s) in group ${groupId}`);

    // Fire all sends concurrently — don't await individually to avoid head-of-line blocking
    await Promise.allSettled(
        subscribers.map(sub => sendTelegram(sub.tg_id, messageBuilder(sub)))
    );
}

/**
 * Escapes HTML special characters in user-supplied strings.
 * Prevents injection into HTML parse mode messages.
 */
function escHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Formats a USDC amount from raw 6-decimal bigint to a human-readable string.
 * e.g. 10_000_000n → "$10.00 USDC"
 */
function formatUsdc(rawAmount) {
    const formatted = (Number(rawAmount) / 10 ** USDC_DECIMALS).toFixed(2);
    return `$${formatted} USDC`;
}

/**
 * Formats a Unix timestamp to a human-readable date string.
 */
function formatTimestamp(unixTs) {
    return new Date(Number(unixTs) * 1000).toLocaleString('en-KE', {
        timeZone: 'Africa/Nairobi',
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

/**
 * Shortens an Ethereum address for display.
 * e.g. 0x1234...5678
 */
function shortAddr(addr) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// =============================================================================
// SECTION 7 — EVENT HANDLERS
// =============================================================================

/**
 * ContributionReceived(groupId, member, amount, timestamp)
 *
 * Notifies:
 *   - The contributing member: personal confirmation
 *   - All other group subscribers: circle update
 */
async function handleContributionReceived(groupId, member, amount, timestamp, event) {
    const txHash = event?.log?.transactionHash || event?.transactionHash || 'pending';
    const blockNumber = event?.log?.blockNumber || event?.blockNumber || 0;

    console.log(`💰 ContributionReceived | Group: ${groupId} | Member: ${member} | ${formatUsdc(amount)}`);
    await logEvent('ContributionReceived', { groupId: groupId.toString(), member, amount: amount.toString() }, txHash, blockNumber);

    const groupName  = await getGroupName(groupId);
    const contributor = await getUserByAddress(member);
    const contributorName = contributor?.display_name || shortAddr(member);

    await broadcastToGroup({
        groupId,
        notificationType: 'contributions',
        messageBuilder: (sub) => {
            const isContributor = sub.smart_account_address.toLowerCase() === member.toLowerCase();

            if (isContributor) {
                return (
                    `✅ <b>Contribution Confirmed</b>\n\n` +
                    `Your contribution of <b>${escHtml(formatUsdc(amount))}</b> to ` +
                    `<b>${escHtml(groupName)}</b> has landed on Base.\n\n` +
                    `⏱ ${formatTimestamp(timestamp)}\n` +
                    `🔗 <a href="https://sepolia.basescan.org/tx/${txHash}">View on BaseScan</a>`
                );
            }

            return (
                `💸 <b>Circle Update — ${escHtml(groupName)}</b>\n\n` +
                `<b>${escHtml(contributorName)}</b> just contributed <b>${escHtml(formatUsdc(amount))}</b> to the circle.\n\n` +
                `⏱ ${formatTimestamp(timestamp)}\n` +
                `🔗 <a href="https://sepolia.basescan.org/tx/${txHash}">View on BaseScan</a>`
            );
        },
    });
}

/**
 * PayoutExecuted(groupId, recipient, amount)
 *
 * Notifies:
 *   - The payout recipient: personal congratulations
 *   - All other group subscribers: who received and how much
 */
async function handlePayoutExecuted(groupId, recipient, amount, event) {
    const txHash = event?.log?.transactionHash || event?.transactionHash || 'pending';
    const blockNumber = event?.log?.blockNumber || event?.blockNumber || 0;

    console.log(`🏆 PayoutExecuted | Group: ${groupId} | Recipient: ${recipient} | ${formatUsdc(amount)}`);
    await logEvent('PayoutExecuted', { groupId: groupId.toString(), recipient, amount: amount.toString() }, txHash, blockNumber);

    const groupName    = await getGroupName(groupId);
    const recipientUser = await getUserByAddress(recipient);
    const recipientName = recipientUser?.display_name || shortAddr(recipient);

    await broadcastToGroup({
        groupId,
        notificationType: 'payouts',
        messageBuilder: (sub) => {
            const isRecipient = sub.smart_account_address.toLowerCase() === recipient.toLowerCase();

            if (isRecipient) {
                return (
                    `🎉 <b>Your Payout Has Arrived!</b>\n\n` +
                    `<b>${escHtml(formatUsdc(amount))}</b> from <b>${escHtml(groupName)}</b> ` +
                    `has been transferred to your Smart Account.\n\n` +
                    `Your circle delivered. Now build something sovereign. 🦁\n\n` +
                    `🔗 <a href="https://sepolia.basescan.org/tx/${txHash}">View on BaseScan</a>`
                );
            }

            return (
                `🏦 <b>Circle Payout — ${escHtml(groupName)}</b>\n\n` +
                `This cycle's payout of <b>${escHtml(formatUsdc(amount))}</b> ` +
                `has been sent to <b>${escHtml(recipientName)}</b>.\n\n` +
                `Your turn is coming. Keep contributing. 🔄\n\n` +
                `🔗 <a href="https://sepolia.basescan.org/tx/${txHash}">View on BaseScan</a>`
            );
        },
    });
}

/**
 * MemberJoined(groupId, member)
 *
 * Notifies all group subscribers that a new member has been admitted.
 */
async function handleMemberJoined(groupId, member, event) {
    const txHash = event?.log?.transactionHash || event?.transactionHash || 'pending';
    const blockNumber = event?.log?.blockNumber || event?.blockNumber || 0;

    console.log(`🤝 MemberJoined | Group: ${groupId} | Member: ${member}`);
    await logEvent('MemberJoined', { groupId: groupId.toString(), member }, txHash, blockNumber);

    const groupName  = await getGroupName(groupId);
    const newMember  = await getUserByAddress(member);
    const memberName = newMember?.display_name || shortAddr(member);

    await broadcastToGroup({
        groupId,
        notificationType: 'contributions', // reuse contributions subscription for membership events
        messageBuilder: (sub) => {
            const isNewMember = sub.smart_account_address.toLowerCase() === member.toLowerCase();

            if (isNewMember) {
                return (
                    `🌟 <b>Welcome to ${escHtml(groupName)}!</b>\n\n` +
                    `Your application has been approved by the circle members. ` +
                    `You are now a verified member of the vault.\n\n` +
                    `Your on-chain reputation starts at <b>50/100</b>. Build it. 🏗️`
                );
            }

            return (
                `👋 <b>New Member — ${escHtml(groupName)}</b>\n\n` +
                `<b>${escHtml(memberName)}</b> has been admitted to the circle. ` +
                `Welcome them to the vault. 🦁`
            );
        },
    });
}

/**
 * LiquidityOptimized(groupId, amountSent)
 *
 * Notifies group subscribers (payouts channel) that idle funds have been
 * deployed to Aave to earn yield. Informational — no action required.
 */
async function handleLiquidityOptimized(groupId, amountSent, event) {
    const txHash = event?.log?.transactionHash || event?.transactionHash || 'pending';
    const blockNumber = event?.log?.blockNumber || event?.blockNumber || 0;

    console.log(`📈 LiquidityOptimized | Group: ${groupId} | Amount: ${formatUsdc(amountSent)}`);
    await logEvent('LiquidityOptimized', { groupId: groupId.toString(), amountSent: amountSent.toString() }, txHash, blockNumber);

    const groupName = await getGroupName(groupId);

    await broadcastToGroup({
        groupId,
        notificationType: 'payouts',
        messageBuilder: () =>
            `📈 <b>Yield Engine Active — ${escHtml(groupName)}</b>\n\n` +
            `<b>${escHtml(formatUsdc(amountSent))}</b> of idle treasury funds have been ` +
            `deployed to Aave V3 to earn yield for the circle.\n\n` +
            `Sovereign money never sleeps. 💰`,
    });
}

/**
 * AssetProposed(proposalId, groupId, registryAssetId)
 *
 * Notifies all group members that a new asset proposal has been submitted
 * and requires their vote.
 */
async function handleAssetProposed(proposalId, groupId, registryAssetId, event) {
    const txHash = event?.log?.transactionHash || event?.transactionHash || 'pending';
    const blockNumber = event?.log?.blockNumber || event?.blockNumber || 0;

    console.log(`🏛️  AssetProposed | Proposal: ${proposalId} | Group: ${groupId}`);
    await logEvent('AssetProposed', { proposalId: proposalId.toString(), groupId: groupId.toString(), registryAssetId: registryAssetId.toString() }, txHash, blockNumber);

    const groupName = await getGroupName(groupId);

    await broadcastToGroup({
        groupId,
        notificationType: 'proposals',
        messageBuilder: () =>
            `🏛️ <b>New Asset Proposal — ${escHtml(groupName)}</b>\n\n` +
            `Proposal <b>#${proposalId}</b> has been submitted for a ` +
            `verified asset (Registry ID: ${registryAssetId}).\n\n` +
            `Open the Kula Vault to review the asset documents and cast your vote. ` +
            `The proposal expires in <b>72 hours</b>.\n\n` +
            `🗳 <a href="https://kula-six.vercel.app/dashboard">Vote Now</a>`,
    });
}

/**
 * JoinRequestSubmitted(groupId, applicant)
 *
 * Notifies existing group members that someone has applied to join.
 * Existing members need to vote to admit or reject the applicant.
 */
async function handleJoinRequestSubmitted(groupId, applicant, event) {
    const txHash = event?.log?.transactionHash || event?.transactionHash || 'pending';
    const blockNumber = event?.log?.blockNumber || event?.blockNumber || 0;

    console.log(`📋 JoinRequestSubmitted | Group: ${groupId} | Applicant: ${applicant}`);
    await logEvent('JoinRequestSubmitted', { groupId: groupId.toString(), applicant }, txHash, blockNumber);

    const groupName      = await getGroupName(groupId);
    const applicantUser  = await getUserByAddress(applicant);
    const applicantName  = applicantUser?.display_name || shortAddr(applicant);
    const reputationScore = applicantUser?.reputation_score ?? 50;
    const reputationTier  = applicantUser?.reputation_tier ?? 'Neutral';

    await broadcastToGroup({
        groupId,
        notificationType: 'proposals',
        messageBuilder: (sub) => {
            // Don't notify the applicant themselves
            if (sub.smart_account_address.toLowerCase() === applicant.toLowerCase()) return null;

            return (
                `🔔 <b>New Join Request — ${escHtml(groupName)}</b>\n\n` +
                `<b>${escHtml(applicantName)}</b> has applied to join the circle.\n\n` +
                `📊 Reputation: <b>${reputationScore}/100</b> (${escHtml(reputationTier)})\n\n` +
                `Open the Admission Hall to review their profile and vote.\n` +
                `🗳 <a href="https://kula-six.vercel.app/dashboard">Review Application</a>`
            );
        },
    });
}

/**
 * ReputationUpdated(member, newScore)
 *
 * Sends a private DM to the affected member only.
 * Not broadcast to the group — reputation changes are personal.
 */
async function handleReputationUpdated(member, newScore, event) {
    const blockNumber = event?.log?.blockNumber || event?.blockNumber || 0;

    console.log(`⭐ ReputationUpdated | Member: ${member} | Score: ${newScore}`);
    await logEvent('ReputationUpdated', { member, newScore: newScore.toString() }, 'n/a', blockNumber);

    const user = await getUserByAddress(member);
    if (!user?.tg_id) return; // No Telegram linked — skip

    const score = Number(newScore);
    const tier  = score >= 80 ? '🥇 Elite'
                : score >= 60 ? '🥈 Trusted'
                : score >= 40 ? '🥉 Neutral'
                :               '⚠️  At Risk';

    const direction = score >= 50 ? '↑ Improved' : '↓ Decreased';

    await sendTelegram(user.tg_id,
        `⭐ <b>Your Reputation Score Updated</b>\n\n` +
        `Score: <b>${score}/100</b> (${direction})\n` +
        `Tier: <b>${tier}</b>\n\n` +
        `${score >= 60
            ? 'Keep contributing on time to unlock higher-tier circles. 🚀'
            : 'Consistent on-time payments will restore your score. Stay committed. 💪'
        }`
    );
}

// ─── Governance event handlers ────────────────────────────────────────────────

/**
 * ProposalCreated(proposalId, proposalType, groupId, proposer, amount, deadline)
 */
async function handleProposalCreated(proposalId, proposalType, groupId, proposer, amount, deadline, event) {
    const txHash = event?.log?.transactionHash || event?.transactionHash || 'pending';
    const blockNumber = event?.log?.blockNumber || event?.blockNumber || 0;

    console.log(`📜 ProposalCreated | Proposal: ${proposalId} | Group: ${groupId} | Type: ${proposalType}`);
    await logEvent('ProposalCreated', {
        proposalId: proposalId.toString(),
        proposalType: proposalType.toString(),
        groupId: groupId.toString(),
        proposer,
        amount: amount.toString(),
        deadline: deadline.toString(),
    }, txHash, blockNumber);

    const groupName = await getGroupName(groupId);
    const typeLabel = ['ROSCA Payout', 'Asset Purchase', 'Direct Bill'][Number(proposalType)] || 'Proposal';

    await broadcastToGroup({
        groupId,
        notificationType: 'proposals',
        messageBuilder: () =>
            `📜 <b>Governance Proposal — ${escHtml(groupName)}</b>\n\n` +
            `A new <b>${typeLabel}</b> proposal (#${proposalId}) has been created.\n` +
            `${amount > 0n ? `Amount: <b>${escHtml(formatUsdc(amount))}</b>\n` : ''}` +
            `Voting closes: <b>${formatTimestamp(deadline)}</b>\n\n` +
            `🗳 <a href="https://kula-six.vercel.app/dashboard">Cast Your Vote</a>`,
    });
}

/**
 * ProposalExecuted(proposalId, proposalType, recipient, amount)
 */
async function handleProposalExecuted(proposalId, proposalType, recipient, amount, event) {
    const txHash = event?.log?.transactionHash || event?.transactionHash || 'pending';
    const blockNumber = event?.log?.blockNumber || event?.blockNumber || 0;

    console.log(`✅ ProposalExecuted | Proposal: ${proposalId} | Type: ${proposalType}`);
    await logEvent('ProposalExecuted', {
        proposalId: proposalId.toString(),
        proposalType: proposalType.toString(),
        recipient,
        amount: amount.toString(),
    }, txHash, blockNumber);

    // Fetch groupId from DB (logged at creation time)
    let groupId = null;
    try {
        const row = await db.query(
            `SELECT event_args->>'groupId' AS group_id FROM event_log WHERE event_name = 'ProposalCreated' AND event_args->>'proposalId' = $1 LIMIT 1`,
            [proposalId.toString()]
        );
        groupId = row.rows[0]?.group_id || null;
    } catch (_) {}

    if (!groupId) {
        console.warn(`⚠️  Could not resolve groupId for executed proposal ${proposalId}`);
        return;
    }

    const groupName  = await getGroupName(groupId);
    const typeLabel  = ['ROSCA Payout', 'Asset Purchase', 'Direct Bill'][Number(proposalType)] || 'Proposal';

    await broadcastToGroup({
        groupId,
        notificationType: 'payouts',
        messageBuilder: () =>
            `✅ <b>Proposal Executed — ${escHtml(groupName)}</b>\n\n` +
            `<b>${typeLabel}</b> proposal #${proposalId} has been approved and executed.\n` +
            `${amount > 0n ? `Amount transferred: <b>${escHtml(formatUsdc(amount))}</b>\n` : ''}` +
            `Governance on-chain. Trust immutable. 🔒\n\n` +
            `🔗 <a href="https://sepolia.basescan.org/tx/${txHash}">View on BaseScan</a>`,
    });
}

// =============================================================================
// SECTION 8 — EVENT SUBSCRIPTION
// =============================================================================

/**
 * Attaches all event listeners to the contract instances.
 * Called once per connection (initial start + each reconnect).
 */
function attachEventListeners() {
    console.log('🔌 Attaching event listeners...');

    // ── RotaryGroup events ────────────────────────────────────────────────────
    rotaryGroup.on('ContributionReceived', handleContributionReceived);
    rotaryGroup.on('PayoutExecuted',       handlePayoutExecuted);
    rotaryGroup.on('MemberJoined',         handleMemberJoined);
    rotaryGroup.on('LiquidityOptimized',   handleLiquidityOptimized);
    rotaryGroup.on('AssetProposed',        handleAssetProposed);
    rotaryGroup.on('JoinRequestSubmitted', handleJoinRequestSubmitted);
    rotaryGroup.on('ReputationUpdated',    handleReputationUpdated);

    // ── KulaGovernance events (optional) ─────────────────────────────────────
    if (governance) {
        governance.on('ProposalCreated',   handleProposalCreated);
        governance.on('ProposalExecuted',  handleProposalExecuted);
        // VoteCast: high-volume, skip broadcast — only log to DB
        governance.on('VoteCast', async (proposalId, voter, support, votesFor, votesAgainst, event) => {
            const txHash = event?.log?.transactionHash || 'pending';
            const blockNumber = event?.log?.blockNumber || 0;
            await logEvent('VoteCast', {
                proposalId: proposalId.toString(), voter, support,
                votesFor: votesFor.toString(), votesAgainst: votesAgainst.toString(),
            }, txHash, blockNumber);
        });
    }

    console.log('✅ Event listeners attached');
}

/**
 * Removes all event listeners from contract instances.
 * Called before reconnecting to prevent duplicate handlers.
 */
function removeEventListeners() {
    if (rotaryGroup) rotaryGroup.removeAllListeners();
    if (governance)  governance.removeAllListeners();
}

// =============================================================================
// SECTION 9 — CATCHUP: REPLAY MISSED EVENTS ON STARTUP
// =============================================================================

/**
 * Queries for events that occurred in the last CATCHUP_BLOCKS blocks and
 * processes any that haven't been logged yet.
 *
 * This ensures no events are missed during a service restart or deployment.
 * Uses queryFilter (polling) which works on both WebSocket and HTTP providers.
 */
async function catchUpMissedEvents() {
    try {
        const currentBlock = await provider.getBlockNumber();
        const startBlock   = Math.max(
            currentBlock - CATCHUP_BLOCKS,
            parseInt(process.env.LISTENER_START_BLOCK || '0', 10)
        );

        console.log(`🔄 Catching up from block ${startBlock} to ${currentBlock}...`);

        // Query each event type and check against event_log for duplicates
        const eventTypes = [
            { name: 'ContributionReceived', contract: rotaryGroup, handler: (e) => handleContributionReceived(...e.args, e) },
            { name: 'PayoutExecuted',       contract: rotaryGroup, handler: (e) => handlePayoutExecuted(...e.args, e) },
            { name: 'MemberJoined',         contract: rotaryGroup, handler: (e) => handleMemberJoined(...e.args, e) },
            { name: 'AssetProposed',        contract: rotaryGroup, handler: (e) => handleAssetProposed(...e.args, e) },
        ];

        if (governance) {
            eventTypes.push(
                { name: 'ProposalCreated',  contract: governance, handler: (e) => handleProposalCreated(...e.args, e) },
                { name: 'ProposalExecuted', contract: governance, handler: (e) => handleProposalExecuted(...e.args, e) },
            );
        }

        for (const { name, contract, handler } of eventTypes) {
            const events = await contract.queryFilter(name, startBlock, currentBlock);

            for (const event of events) {
                const txHash = event.transactionHash;

                // Check if already processed
                const existing = await db.query(
                    `SELECT id FROM event_log WHERE tx_hash = $1 AND event_name = $2`,
                    [txHash, name]
                );

                if (existing.rows.length === 0) {
                    console.log(`♻️  Replaying missed ${name} at tx: ${txHash}`);
                    await handler(event);
                }
            }
        }

        lastProcessedBlock = currentBlock;
        console.log(`✅ Catch-up complete. Listening from block ${currentBlock}`);
    } catch (err) {
        console.error('Catch-up error:', err.message);
        // Non-fatal — real-time listeners are still active
    }
}

// =============================================================================
// SECTION 10 — CONNECTION MANAGEMENT
// =============================================================================

/**
 * Initialises providers and contract instances.
 * Prefers a WebSocket connection for real-time events.
 * Falls back to HTTP polling (JsonRpcProvider) if no WSS URL is configured.
 *
 * @returns {boolean} — true if WebSocket connected, false if HTTP fallback
 */
function buildProvider() {
    const wssUrl  = process.env.BASE_SEPOLIA_WSS;
    const httpUrl = process.env.BASE_SEPOLIA_RPC;

    if (wssUrl) {
        console.log('🌐 Connecting via WebSocket...');
        provider = new ethers.WebSocketProvider(wssUrl);
        return true;
    }

    console.log('⚠️  No BASE_SEPOLIA_WSS set — using HTTP provider (polling mode)');
    provider = new ethers.JsonRpcProvider(httpUrl);
    return false;
}

/**
 * Starts the listener service.
 * 1. Builds provider
 * 2. Instantiates contract objects
 * 3. Replays missed events (catch-up)
 * 4. Attaches real-time event listeners
 * 5. Registers WebSocket disconnect handler for reconnection
 */
async function startListener() {
    console.log('\n🚀 KULA Event Listener starting...');
    console.log(`   RotaryGroup:  ${process.env.ROTARY_GROUP_CONTRACT}`);
    console.log(`   Governance:   ${GOVERNANCE_ADDRESS || 'not configured'}`);
    console.log(`   Chain:        Base Sepolia (${BASE_SEPOLIA_CHAIN_ID})\n`);

    const isWebSocket = buildProvider();

    // Wire up contract instances to the new provider
    rotaryGroup = new ethers.Contract(
        process.env.ROTARY_GROUP_CONTRACT,
        ROTARY_GROUP_ABI,
        provider
    );

    if (GOVERNANCE_ADDRESS) {
        governance = new ethers.Contract(
            GOVERNANCE_ADDRESS,
            GOVERNANCE_ABI,
            provider
        );
    }

    // Replay any events missed since last run
    await catchUpMissedEvents();

    // Attach live event listeners
    removeEventListeners(); // clear any stale handlers from a previous reconnect
    attachEventListeners();

    // WebSocket disconnect → reconnect with exponential back-off
    if (isWebSocket) {
        provider.websocket.on('close', async (code) => {
            console.warn(`🔌 WebSocket closed (code: ${code}). Reconnecting...`);
            removeEventListeners();
            await reconnectWithBackoff();
        });

        provider.websocket.on('error', (err) => {
            console.error('WebSocket error:', err.message);
        });
    }

    reconnectAttempts = 0; // Reset back-off counter on successful start
    console.log('👂 Listening for on-chain events...\n');
}

/**
 * Reconnects with exponential back-off after a WebSocket disconnect.
 * Back-off: 5s → 10s → 20s → ... → 5min (capped)
 */
async function reconnectWithBackoff() {
    const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(RECONNECT_FACTOR, reconnectAttempts),
        RECONNECT_MAX_MS
    );
    reconnectAttempts++;

    console.log(`⏳ Reconnect attempt ${reconnectAttempts} in ${delay / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
        await startListener();
    } catch (err) {
        console.error(`Reconnect attempt ${reconnectAttempts} failed:`, err.message);
        await reconnectWithBackoff();
    }
}

// =============================================================================
// SECTION 11 — PROCESS-LEVEL ERROR HANDLING & GRACEFUL SHUTDOWN
// =============================================================================

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught exception:', err.message, err.stack);
    // Don't exit — keep the listener alive for transient errors
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled rejection:', reason);
});

process.on('SIGTERM', async () => {
    console.log('\n⏹  SIGTERM received — shutting down gracefully...');
    removeEventListeners();
    await db.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\n⏹  SIGINT received — shutting down gracefully...');
    removeEventListeners();
    await db.end();
    process.exit(0);
});

// =============================================================================
// SECTION 12 — ENTRY POINT
// =============================================================================

startListener().catch(async (err) => {
    console.error('❌ Failed to start listener:', err.message);
    // Initial start failure — retry with back-off
    await reconnectWithBackoff();
});
