// FILE: frontend/src/app/dashboard/DashboardClient.tsx
// PURPOSE: TMA-first KULA Vault dashboard.
//   - Gasless 1-click Contribute via useSmartAccount → Pimlico paymaster
//   - Native TMA haptics via useTelegramContext().triggerHaptic()
//   - Inline transaction status pills (non-blocking) for pending UserOps
//   - Polls pollOpStatus until CONFIRMED/FAILED without freezing UI
//   - "Dark Luxury" Obsidian/Gold aesthetic · Framer Motion throughout
//   - Full tab system: My Circle · Asset Vault · Voting Hall · Treasurer · Chat

"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Users,
  Landmark,
  Receipt,
  ShieldCheck,
  MessageCircle,
  PlusCircle,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  TrendingUp,
  ArrowUpRight,
  Wallet,
  Star,
  Shield,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertTriangle,
  Info,
  ChevronDown,
} from "lucide-react";
import { useReadContract, useReadContracts } from "wagmi";
import { baseSepolia } from "wagmi/chains";

import Navbar from "@/components/Navbar";
import AssetVault from "@/components/AssetVault";
import TreasurerView from "@/components/TreasurerView";
import MemberDirectory from "@/components/MemberDirectory";
import GoldParticles from "@/components/GoldParticles";
import ExclusiveModal from "@/components/ExclusiveModal";
import KulaRoadmap from "@/components/KulaRoadmap";
import IdentityHub from "@/components/IdentityHub";
import GroupChatWall from "@/components/GroupChatWall";
import GrowthPulse from "@/components/GrowthPulse";

import useKulaStore, {
  selectActiveGroupId,
  selectActiveGroupName,
  selectSmartAccountAddress,
  selectWalletSource,
  selectTelegramUser,
  selectRecentTxs,
  selectReputationScore,
  formatSmartAccountBalance,
  shortenAddress,
} from "@/store/useKulaStore";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import { useTelegramContext } from "@/providers/TelegramProvider";

// ---------------------------------------------------------------------------
// CONTRACT CONFIG
// ---------------------------------------------------------------------------

const ROTARY_ADDRESS = (
  process.env.NEXT_PUBLIC_ROTARY_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

const ROTARY_GROUP_ABI = [
  {
    name: "groups",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_groupId", type: "uint256" }],
    outputs: [
      { name: "id",                 type: "uint256" },
      { name: "name",               type: "string"  },
      { name: "treasurer",          type: "address" },
      { name: "contributionAmount", type: "uint256" },
      { name: "intervalSeconds",    type: "uint256" },
      { name: "currentBalance",     type: "uint256" },
      { name: "totalContributed",   type: "uint256" },
      { name: "active",             type: "bool"    },
      { name: "currentRecipientIndex", type: "uint256" },
      { name: "lastPayoutTimestamp",   type: "uint256" },
    ],
  },
  {
    name: "getMemberCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_groupId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "reputations",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [
      { name: "score",             type: "uint256" },
      { name: "consistentPayments", type: "uint256" },
      { name: "totalDelays",        type: "uint256" },
    ],
  },
  {
    name: "isMember",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_groupId", type: "uint256" },
      { name: "_addr",    type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function formatUsdc(raw: bigint): string {
  if (!raw || raw === 0n) return "0.00";
  const whole = raw / 1_000_000n;
  const frac  = (raw % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole.toLocaleString()}.${frac}`;
}

function formatInterval(seconds: bigint): string {
  const s = Number(seconds);
  if (s >= 86400 * 28) return "Monthly";
  if (s >= 86400 * 7)  return "Weekly";
  if (s >= 86400)      return "Daily";
  return `${s}s`;
}

function nextPayoutDate(lastTs: bigint, interval: bigint): string {
  const next = (Number(lastTs) + Number(interval)) * 1000;
  if (!next || next <= 0) return "—";
  return new Date(next).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// TX STATUS PILL
// ---------------------------------------------------------------------------

type TxPhase = "idle" | "signing" | "pending" | "confirmed" | "failed";

interface StatusPillProps {
  phase:   TxPhase;
  opHash?: string | null;
}

function StatusPill({ phase, opHash }: StatusPillProps) {
  if (phase === "idle") return null;

  const configs: Record<
    Exclude<TxPhase, "idle">,
    { bg: string; border: string; text: string; icon: React.ReactNode; label: string }
  > = {
    signing: {
      bg:     "bg-amber-500/10",
      border: "border-amber-500/30",
      text:   "text-amber-400",
      icon:   <Loader2 size={12} className="animate-spin" />,
      label:  "Awaiting Signature…",
    },
    pending: {
      bg:     "bg-blue-500/10",
      border: "border-blue-500/30",
      text:   "text-blue-400",
      icon:   <Clock size={12} className="animate-pulse" />,
      label:  "Bundling UserOp…",
    },
    confirmed: {
      bg:     "bg-green-500/10",
      border: "border-green-500/30",
      text:   "text-green-400",
      icon:   <CheckCircle2 size={12} />,
      label:  "Confirmed On-Chain",
    },
    failed: {
      bg:     "bg-red-500/10",
      border: "border-red-500/30",
      text:   "text-red-400",
      icon:   <XCircle size={12} />,
      label:  "Transaction Failed",
    },
  };

  const c = configs[phase];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.95 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold ${c.bg} ${c.border} ${c.text}`}
    >
      {c.icon}
      <span>{c.label}</span>
      {opHash && phase === "pending" && (
        <a
          href={`https://jiffyscan.xyz/userOpHash/${opHash}?network=base-sepolia`}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-60 hover:opacity-100 transition-opacity"
        >
          <ExternalLink size={10} />
        </a>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// CONTRIBUTE BUTTON — 1-click gasless
// ---------------------------------------------------------------------------

interface ContributeButtonProps {
  groupId:            number;
  contributionAmount: bigint;
  disabled?:          boolean;
}

function ContributeButton({ groupId, contributionAmount, disabled }: ContributeButtonProps) {
  const { contribute, isSubmitting, lastOpHash, lastError, pollOpStatus } =
    useSmartAccount();
  const { triggerHaptic, isTma } = useTelegramContext();

  const [phase, setPhase] = useState<TxPhase>("idle");
  const pollerRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-clear "confirmed" pill after 4 s
  useEffect(() => {
    if (phase === "confirmed") {
      const t = setTimeout(() => setPhase("idle"), 4_000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Poll until resolved
  useEffect(() => {
    if (!lastOpHash || phase !== "pending") return;

    let attempts = 0;
    const MAX    = 45;

    pollerRef.current = setInterval(async () => {
      attempts++;
      const status = await pollOpStatus(lastOpHash);

      if (status === "CONFIRMED") {
        clearInterval(pollerRef.current!);
        setPhase("confirmed");
        if (isTma) triggerHaptic("heavy");
        // Notify TMA MainButton if present
        try { window.Telegram?.WebApp?.MainButton?.hideProgress(); } catch {}
      } else if (status === "FAILED" || attempts >= MAX) {
        clearInterval(pollerRef.current!);
        setPhase("failed");
        if (isTma) window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
      }
    }, 4_000);

    return () => { if (pollerRef.current) clearInterval(pollerRef.current); };
  }, [lastOpHash, phase, pollOpStatus, isTma, triggerHaptic]);

  const handleContribute = useCallback(async () => {
    if (isSubmitting || !contributionAmount) return;

    // Haptic feedback on tap
    if (isTma) triggerHaptic("medium");

    setPhase("signing");

    // TMA MainButton loading indicator (non-blocking — no await)
    try {
      window.Telegram?.WebApp?.MainButton?.showProgress(true);
    } catch {}

    const opHash = await contribute(groupId, contributionAmount);

    if (opHash) {
      setPhase("pending");
    } else {
      setPhase("failed");
      if (isTma) window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
      try { window.Telegram?.WebApp?.MainButton?.hideProgress(); } catch {}
    }
  }, [isSubmitting, contributionAmount, groupId, contribute, isTma, triggerHaptic]);

  const isLocked = isSubmitting || phase === "signing" || phase === "pending";

  return (
    <div className="flex flex-col items-stretch gap-3">
      {/* Action button */}
      <motion.button
        whileHover={!isLocked && !disabled ? { scale: 1.02 } : {}}
        whileTap={!isLocked && !disabled ? { scale: 0.96 } : {}}
        onClick={handleContribute}
        disabled={isLocked || disabled || !contributionAmount}
        className={`
          relative w-full py-5 rounded-2xl flex items-center justify-center gap-3
          font-black text-xs uppercase tracking-[0.28em] transition-all
          ${isLocked || disabled
            ? "bg-[#D4AF37]/30 text-[#D4AF37]/50 cursor-not-allowed"
            : "bg-[#D4AF37] hover:bg-[#c9a62e] text-[#0F0F0F] shadow-[0_8px_28px_rgba(212,175,55,0.30)]"
          }
        `}
      >
        {/* Sheen sweep */}
        {!isLocked && !disabled && (
          <motion.span
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ repeat: Infinity, duration: 3.5, ease: "linear", delay: 1.5 }}
            className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
          />
        )}

        {phase === "signing" ? (
          <><Loader2 size={14} className="animate-spin" /> Awaiting Signature…</>
        ) : phase === "pending" ? (
          <><Clock size={14} className="animate-pulse" /> Bundling…</>
        ) : (
          <>
            <Zap size={14} fill="currentColor" />
            Contribute {contributionAmount > 0n ? `${formatUsdc(contributionAmount)} USDC` : ""}
          </>
        )}
      </motion.button>

      {/* Status pill — inline, non-blocking */}
      <AnimatePresence mode="wait">
        {phase !== "idle" && (
          <div className="flex justify-center">
            <StatusPill phase={phase} opHash={lastOpHash} />
          </div>
        )}
      </AnimatePresence>

      {/* Error detail */}
      <AnimatePresence>
        {phase === "failed" && lastError && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[10px] text-red-400/80 text-center leading-relaxed"
          >
            {lastError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Gas-free badge */}
      <p className="text-center text-[9px] text-[#F3E5AB]/25 font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
        <Zap size={8} className="text-green-400" fill="currentColor" />
        Gas sponsored by Pimlico · no ETH required
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// REPUTATION BADGE
// ---------------------------------------------------------------------------

function ReputationBadge({ score }: { score: number }) {
  const tier =
    score >= 80 ? { label: "Elite",   color: "#D4AF37",  glow: "shadow-[0_0_12px_rgba(212,175,55,0.5)]" } :
    score >= 60 ? { label: "Trusted", color: "#6ee7b7",  glow: "shadow-[0_0_10px_rgba(110,231,183,0.4)]" } :
    score >= 40 ? { label: "Neutral", color: "#94a3b8",  glow: "" } :
                  { label: "At Risk", color: "#f87171",  glow: "shadow-[0_0_10px_rgba(248,113,113,0.3)]" };

  const pct = Math.min(100, Math.max(0, score));

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#ffffff08" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.5" fill="none"
            stroke={tier.color} strokeWidth="3"
            strokeDasharray={`${97.4 * pct / 100} 97.4`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black" style={{ color: tier.color }}>
          {pct}
        </span>
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-[#F3E5AB]/30">Reputation</p>
        <p className={`text-xs font-bold ${tier.glow}`} style={{ color: tier.color }}>{tier.label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TRANSACTION HISTORY FEED
// ---------------------------------------------------------------------------

function TxFeed() {
  const recentTxs = useKulaStore(selectRecentTxs);

  if (!recentTxs.length) {
    return (
      <div className="text-center py-8 text-[#F3E5AB]/25 text-xs uppercase tracking-widest">
        No transactions yet
      </div>
    );
  }

  const TYPE_LABEL: Record<string, string> = {
    deposit:       "Contribution",
    propose_asset: "Asset Proposal",
    vote_asset:    "Vote Cast",
    approve_usdc:  "USDC Approval",
    payout:        "Payout",
  };

  return (
    <div className="space-y-2">
      {recentTxs.slice(0, 6).map((tx) => (
        <motion.div
          key={tx.userOpHash}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center justify-between px-4 py-3 bg-[#0F0F0F] rounded-2xl border border-[#D4AF37]/8 hover:border-[#D4AF37]/20 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${
                tx.status === "CONFIRMED" ? "bg-green-500" :
                tx.status === "FAILED"    ? "bg-red-500"   : "bg-amber-400 animate-pulse"
              }`}
            />
            <div>
              <p className="text-xs font-bold text-[#F3E5AB]/80">
                {TYPE_LABEL[tx.type] ?? tx.type}
              </p>
              <p className="text-[9px] text-[#F3E5AB]/30 font-mono">
                {shortenAddress(tx.userOpHash)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tx.amount && tx.amount > 0n && (
              <span className="text-xs font-bold text-[#D4AF37]">
                {formatUsdc(tx.amount)} USDC
              </span>
            )}
            {tx.txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
              >
                <ExternalLink size={11} className="text-[#D4AF37]" />
              </a>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN CIRCLE PANEL (Rotary View)
// ---------------------------------------------------------------------------

interface CirclePanelProps {
  groupId:   number;
  groupName: string;
}

function CirclePanel({ groupId, groupName }: CirclePanelProps) {
  const smartAccountAddress = useKulaStore(selectSmartAccountAddress);
  const reputationScore     = useKulaStore(selectReputationScore);

  // Fetch live group data
  const { data: groupData, isLoading } = useReadContract({
    address:      ROTARY_ADDRESS,
    abi:          ROTARY_GROUP_ABI,
    functionName: "groups",
    args:         [BigInt(groupId)],
    chainId:      baseSepolia.id,
    query:        { refetchInterval: 15_000 },
  });

  const { data: memberCount } = useReadContract({
    address:      ROTARY_ADDRESS,
    abi:          ROTARY_GROUP_ABI,
    functionName: "getMemberCount",
    args:         [BigInt(groupId)],
    chainId:      baseSepolia.id,
    query:        { refetchInterval: 30_000 },
  });

  // Parse group tuple
  const group = useMemo(() => {
    if (!groupData) return null;
    const g = groupData as unknown as bigint[];
    return {
      id:                  Number(g[0]),
      name:                (groupData as unknown as (string | bigint | boolean)[])[1] as string,
      treasurer:           (groupData as unknown as (string | bigint | boolean)[])[2] as string,
      contributionAmount:  g[3] as bigint,
      intervalSeconds:     g[4] as bigint,
      currentBalance:      g[5] as bigint,
      totalContributed:    g[6] as bigint,
      active:              (groupData as unknown as (string | bigint | boolean)[])[7] as boolean,
      recipientIndex:      Number(g[8]),
      lastPayoutTimestamp: g[9] as bigint,
    };
  }, [groupData]);

  const isTreasurer = group
    ? smartAccountAddress?.toLowerCase() === group.treasurer.toLowerCase()
    : false;

  // Cycle progress (percentage of contribution target met)
  const cycleProgress = useMemo(() => {
    if (!group || !memberCount) return 0;
    const target = group.contributionAmount * BigInt(Number(memberCount));
    if (target === 0n) return 0;
    const pct = Number((group.currentBalance * 100n) / target);
    return Math.min(100, pct);
  }, [group, memberCount]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className="w-10 h-10 rounded-full border-2 border-t-[#D4AF37] border-r-[#D4AF37]/20 border-b-transparent border-l-transparent"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

      {/* LEFT: Primary vault card */}
      <div className="lg:col-span-8 space-y-6">

        {/* Treasury card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative overflow-hidden rounded-[3rem] bg-[#1B1212] border border-[#D4AF37]/20 p-10"
        >
          {/* Background grain texture */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
          {/* Top gold strip */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-50 rounded-t-[3rem]" />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="uppercase text-[10px] tracking-[0.35em] text-[#D4AF37] font-black mb-2">
                  Circle Treasury
                </p>
                <h2 className="text-5xl md:text-6xl font-serif tracking-tighter text-[#F3E5AB]">
                  ${formatUsdc(group?.currentBalance ?? 0n)}
                </h2>
              </div>
              <div className="flex flex-col items-end gap-2">
                {group?.active ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/25 rounded-full text-[9px] font-black uppercase tracking-widest text-green-400">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/25 rounded-full text-[9px] font-black uppercase tracking-widest text-red-400">
                    Inactive
                  </span>
                )}
                {isTreasurer && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-full text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">
                    <Shield size={9} />
                    Treasurer
                  </span>
                )}
              </div>
            </div>

            {/* Cycle progress bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#F3E5AB]/30">
                  Cycle Progress
                </span>
                <span className="text-[9px] font-black text-[#D4AF37]">
                  {cycleProgress}%
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${cycleProgress}%` }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #D4AF37, #F3E5AB, #D4AF37)",
                    backgroundSize: "200% 100%",
                  }}
                />
              </div>
            </div>

            {/* Quick stats row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: "Members",         value: memberCount ? String(Number(memberCount)) : "—" },
                { label: "Contribution",    value: group ? `$${formatUsdc(group.contributionAmount)}` : "—" },
                { label: "Interval",        value: group ? formatInterval(group.intervalSeconds) : "—" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/[0.02] rounded-2xl px-4 py-3 border border-white/5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-[#F3E5AB]/30 mb-1">
                    {stat.label}
                  </p>
                  <p className="text-sm font-bold text-[#F3E5AB]">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* GrowthPulse chart */}
            <GrowthPulse />

            {/* Divider */}
            <div className="h-px bg-[#D4AF37]/8 my-8" />

            {/* 1-click Gasless Contribute */}
            <ContributeButton
              groupId={groupId}
              contributionAmount={group?.contributionAmount ?? 0n}
              disabled={!group?.active}
            />
          </div>
        </motion.div>

        {/* Payout countdown card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-[2rem] bg-[#1B1212] border border-[#D4AF37]/12 p-8 flex items-center justify-between"
        >
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#F3E5AB]/30 mb-2">
              Next Payout
            </p>
            <p className="text-xl font-serif text-[#F3E5AB]">
              {group
                ? nextPayoutDate(group.lastPayoutTimestamp, group.intervalSeconds)
                : "—"}
            </p>
            <p className="text-xs text-[#F3E5AB]/40 mt-1">
              Recipient #{group ? (group.recipientIndex + 1) : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#F3E5AB]/30 mb-2">
              Total Contributed
            </p>
            <p className="text-2xl font-bold text-[#D4AF37]">
              ${formatUsdc(group?.totalContributed ?? 0n)}
            </p>
          </div>
        </motion.div>

        {/* Recent transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="rounded-[2rem] bg-[#1B1212] border border-[#D4AF37]/12 p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">
              Transaction Ledger
            </p>
            <Receipt size={14} className="text-[#D4AF37]/40" />
          </div>
          <TxFeed />
        </motion.div>
      </div>

      {/* RIGHT: Sidebar */}
      <div className="lg:col-span-4 space-y-6">

        {/* Identity card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-[2.5rem] bg-[#1B1212] border border-[#D4AF37]/15 p-8"
        >
          <p className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]/50 mb-5">
            Your Identity
          </p>
          <ReputationBadge score={reputationScore} />
          {smartAccountAddress && (
            <div className="mt-5 flex items-center justify-between px-4 py-3 bg-[#0F0F0F] rounded-2xl border border-[#D4AF37]/8 group cursor-pointer hover:border-[#D4AF37]/25 transition-all"
              onClick={() => navigator.clipboard?.writeText(smartAccountAddress)}
            >
              <span className="text-[9px] font-mono text-[#F3E5AB]/40">
                {shortenAddress(smartAccountAddress)}
              </span>
              <Copy size={10} className="text-[#D4AF37]/30 group-hover:text-[#D4AF37]/70 transition-colors" />
            </div>
          )}
        </motion.div>

        {/* Members */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <MemberDirectory />
        </motion.div>

        {/* Roadmap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <KulaRoadmap />
        </motion.div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EMPTY GROUP STATE
// ---------------------------------------------------------------------------

function NoGroupState({ onCreateGroup }: { onCreateGroup: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-[#D4AF37]/8 border border-[#D4AF37]/20 flex items-center justify-center mb-8">
        <Users size={32} className="text-[#D4AF37]/60" />
      </div>
      <h3 className="text-2xl font-serif text-[#F3E5AB] mb-3">No Active Circle</h3>
      <p className="text-sm text-[#F3E5AB]/40 max-w-xs leading-relaxed mb-8">
        You are not yet a member of a KULA circle. Create one or request to join an existing group.
      </p>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onCreateGroup}
        className="px-12 py-5 bg-[#D4AF37] text-[#0F0F0F] font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-[0_8px_28px_rgba(212,175,55,0.3)] flex items-center gap-3"
      >
        <PlusCircle size={16} />
        Initialize Your Circle
      </motion.button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// TAB CONFIG
// ---------------------------------------------------------------------------

type TabId = "rotary" | "assets" | "votes" | "treasurer" | "chat";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "rotary",     label: "My Circle",   icon: <Users      size={15} /> },
  { id: "assets",     label: "Asset Vault", icon: <Landmark   size={15} /> },
  { id: "votes",      label: "Voting Hall", icon: <Receipt    size={15} /> },
  { id: "treasurer",  label: "Treasurer",   icon: <ShieldCheck size={15} /> },
  { id: "chat",       label: "Circle Chat", icon: <MessageCircle size={15} /> },
];

// ---------------------------------------------------------------------------
// ROOT DASHBOARD CLIENT
// ---------------------------------------------------------------------------

export default function DashboardClient() {
  const [activeTab,  setActiveTab]  = useState<TabId>("rotary");
  const [modalType,  setModalType]  = useState<string | null>(null);

  const prefersReduced = useReducedMotion();

  const activeGroupId    = useKulaStore(selectActiveGroupId);
  const activeGroupName  = useKulaStore(selectActiveGroupName);
  const smartAccountAddr = useKulaStore(selectSmartAccountAddress);
  const walletSource     = useKulaStore(selectWalletSource);
  const telegramUser     = useKulaStore(selectTelegramUser);

  const { isTma, tgUser, triggerHaptic } = useTelegramContext();

  // Display name: prefer TMA user data, fall back to address
  const displayName = useMemo(() => {
    if (tgUser?.displayName)    return tgUser.displayName;
    if (telegramUser?.displayName) return telegramUser.displayName;
    return shortenAddress(smartAccountAddr);
  }, [tgUser, telegramUser, smartAccountAddr]);

  // Haptic on tab change (TMA only)
  const handleTabChange = useCallback((tabId: TabId) => {
    if (isTma && tabId !== activeTab) triggerHaptic("light");
    setActiveTab(tabId);
  }, [isTma, activeTab, triggerHaptic]);

  const tabContentVariants = {
    initial: { opacity: 0, y: prefersReduced ? 0 : 16 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: prefersReduced ? 0 : -16 },
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F3E5AB] pb-32 overflow-x-hidden tg-safe-area">
      <GoldParticles />
      <Navbar />

      <main className="relative z-10 pt-28 px-5 md:px-8 max-w-6xl mx-auto">

        {/* ── Dashboard Header ───────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#D4AF37] uppercase tracking-[0.42em] text-[9px] font-black mb-2 flex items-center gap-2">
                {isTma && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#229ED9]/15 border border-[#229ED9]/30 rounded-full text-[#229ED9]">
                    <span className="w-1 h-1 bg-[#229ED9] rounded-full animate-pulse" />
                    TMA
                  </span>
                )}
                SOVEREIGN CIRCLE
              </p>
              <h1 className="text-4xl md:text-5xl font-serif tracking-tighter leading-none">
                The Kula{" "}
                <span className="shimmer-text">Vault</span>
              </h1>
            </div>

            <div className="flex flex-col items-end gap-2">
              {/* Group name badge */}
              {activeGroupName && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37]/8 border border-[#D4AF37]/20 rounded-full"
                >
                  <Users size={11} className="text-[#D4AF37]" />
                  <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">
                    {activeGroupName}
                  </span>
                </motion.div>
              )}

              {/* User identity pill */}
              {smartAccountAddr && (
                <div className="hidden md:flex items-center gap-2 text-[9px] font-mono text-[#D4AF37]/50">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {displayName}
                </div>
              )}
            </div>
          </div>
        </motion.header>

        {/* ── Tab Navigation ─────────────────────────────────────────────── */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 mb-10 pb-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  group flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl
                  transition-all font-black text-[10px] uppercase tracking-widest relative
                  ${active
                    ? "bg-[#D4AF37]/12 border border-[#D4AF37]/30 text-[#D4AF37]"
                    : "border border-transparent text-[#F3E5AB]/40 hover:text-[#F3E5AB]/70 hover:bg-white/[0.03]"
                  }
                `}
              >
                <span className={`transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-105"}`}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {active && (
                  <motion.div
                    layoutId="tabIndicator"
                    className="absolute inset-0 rounded-2xl border border-[#D4AF37]/30 pointer-events-none"
                    transition={{ type: "spring", damping: 26, stiffness: 320 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* MY CIRCLE */}
            {activeTab === "rotary" && (
              activeGroupId !== null ? (
                <CirclePanel
                  groupId={activeGroupId}
                  groupName={activeGroupName ?? `Circle #${activeGroupId}`}
                />
              ) : (
                <NoGroupState onCreateGroup={() => setModalType("create")} />
              )
            )}

            {/* ASSET VAULT */}
            {activeTab === "assets" && <AssetVault />}

            {/* VOTING HALL */}
            {activeTab === "votes" && (
              <div className="space-y-6">
                <div className="rounded-[2.5rem] bg-[#1B1212] border border-[#D4AF37]/15 p-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#D4AF37]/8 border border-[#D4AF37]/20 flex items-center justify-center mx-auto mb-6">
                    <Receipt size={24} className="text-[#D4AF37]/60" />
                  </div>
                  <h3 className="text-2xl font-serif text-[#F3E5AB] mb-3">Voting Hall</h3>
                  <p className="text-sm text-[#F3E5AB]/40 max-w-sm mx-auto leading-relaxed mb-8">
                    Active proposals and governance votes will appear here once a group member submits a proposal via the Asset Vault.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { if (isTma) triggerHaptic("light"); setActiveTab("assets"); }}
                    className="px-10 py-4 bg-[#D4AF37]/10 border border-[#D4AF37]/30 hover:bg-[#D4AF37]/20 rounded-2xl text-xs font-black uppercase tracking-widest text-[#D4AF37] transition-all flex items-center gap-2 mx-auto"
                  >
                    <Landmark size={14} /> Browse Asset Vault
                  </motion.button>
                </div>
              </div>
            )}

            {/* TREASURER */}
            {activeTab === "treasurer" && <TreasurerView />}

            {/* CIRCLE CHAT */}
            {activeTab === "chat" && <GroupChatWall />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Floating Action Button ─────────────────────────────────────── */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => {
          if (isTma) triggerHaptic("medium");
          setModalType("create");
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: "spring" }}
        className="fixed bottom-8 right-6 w-14 h-14 bg-[#D4AF37] text-[#0F0F0F] rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(212,175,55,0.45)] z-50"
        aria-label="Create new circle"
      >
        <PlusCircle size={24} strokeWidth={2.5} />
      </motion.button>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <ExclusiveModal
        isOpen={modalType === "identity"}
        onClose={() => setModalType(null)}
        title="Identity Vault"
      >
        <IdentityHub />
      </ExclusiveModal>

      <ExclusiveModal
        isOpen={modalType === "create"}
        onClose={() => setModalType(null)}
        title="Initialize New Circle"
      >
        {/* CreateGroupWizard placeholder — wire in when ready */}
        <div className="py-12 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center mx-auto">
            <Users size={28} className="text-[#D4AF37]" />
          </div>
          <p className="text-2xl font-serif text-[#F3E5AB]">Create Group Wizard</p>
          <p className="text-sm text-[#F3E5AB]/50 max-w-xs mx-auto leading-relaxed">
            The full group creation wizard is being integrated. Check the roadmap for the launch timeline.
          </p>
          <div className="flex items-center justify-center gap-2 px-6 py-3 bg-[#D4AF37]/8 border border-[#D4AF37]/20 rounded-full w-fit mx-auto">
            <Info size={12} className="text-[#D4AF37]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
              Coming Next Sprint
            </span>
          </div>
        </div>
      </ExclusiveModal>
    </div>
  );
}
