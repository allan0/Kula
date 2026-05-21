// FILE: frontend/src/components/PurchaseExecution.tsx
// PURPOSE: Modal for submitting a group RWA acquisition proposal on-chain.
//
// FLOW:
//   1. Member fills: description (required), requested USDC amount (required)
//   2. Component validates amount ≤ group treasury balance
//   3. Calls proposeAsset(groupId, asset.id, description, requestedAmountBigInt)
//      via useSmartAccount — gasless, signed by Privy embedded wallet
//   4. Displays pending state with pulsing status bar (no freeze — non-blocking)
//   5. On CONFIRMED: cinematic gold seal, onSuccess(hash) callback
//   6. Backdrop + Escape-key dismissal guard during submission
//
// DESIGN: Slides up from bottom, obsidian/gold, Framer Motion spring physics.

"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Gavel,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Zap,
  ChevronDown,
  ChevronUp,
  Info,
  DollarSign,
  FileText,
  BadgeCheck,
  Landmark,
  Car,
} from "lucide-react";
import { useReadContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";

import useKulaStore, {
  selectSmartAccountAddress,
  formatSmartAccountBalance,
} from "@/store/useKulaStore";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import type { RWAAsset } from "./GlobalMarketplace";

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const USDC_DECIMALS     = 6;
const USDC_MULTIPLIER   = 10 ** USDC_DECIMALS;
const MIN_USDC_AMOUNT   = 1;       // $1 minimum
const MAX_DESCRIPTION   = 300;

const ROTARY_ADDRESS = (
  process.env.NEXT_PUBLIC_ROTARY_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

const ROTARY_BALANCE_ABI = [
  {
    name: "groups",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "groupId", type: "uint256" }],
    outputs: [
      { name: "id",                 type: "uint256" },
      { name: "name",               type: "string"  },
      { name: "treasurer",          type: "address" },
      { name: "contributionAmount", type: "uint256" },
      { name: "intervalSeconds",    type: "uint256" },
      { name: "balance",            type: "uint256" },
      { name: "active",             type: "bool"    },
      { name: "lastPayoutTimestamp",type: "uint256" },
      { name: "payoutIndex",        type: "uint256" },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

function ipfsUrl(cid: string): string {
  if (!cid || cid.length < 5) return "";
  if (cid.startsWith("http")) return cid;
  return `${IPFS_GATEWAY}${cid}`;
}

function usdcToBigInt(usdcStr: string): bigint {
  try {
    const clean = usdcStr.replace(/,/g, "").trim();
    if (!clean || isNaN(Number(clean))) return 0n;
    const [whole, frac = ""] = clean.split(".");
    const fracPadded = frac.padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
    return BigInt(whole) * BigInt(USDC_MULTIPLIER) + BigInt(fracPadded);
  } catch { return 0n; }
}

function bigIntToUsdc(raw: bigint): string {
  if (!raw || raw === 0n) return "0.00";
  const whole = raw / BigInt(USDC_MULTIPLIER);
  const frac  = (raw % BigInt(USDC_MULTIPLIER)).toString().padStart(USDC_DECIMALS, "0").slice(0, 2);
  return `${whole.toLocaleString()}.${frac}`;
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const ASSET_TYPE_ICON: Record<string, React.ReactNode> = {
  land_deed:         <Landmark size={18} className="text-[#D4AF37]" />,
  vehicle_logbook:   <Car      size={18} className="text-[#D4AF37]" />,
  title_certificate: <FileText size={18} className="text-[#D4AF37]" />,
  other:             <FileText size={18} className="text-[#D4AF37]" />,
};

// ---------------------------------------------------------------------------
// STEP INDICATOR
// ---------------------------------------------------------------------------

type Step = "form" | "signing" | "pending" | "confirmed" | "failed";

interface StepIndicatorProps {
  step: Step;
}

function StepIndicator({ step }: StepIndicatorProps) {
  const steps: { key: Step | string; label: string }[] = [
    { key: "form",      label: "Review"   },
    { key: "signing",   label: "Sign"     },
    { key: "pending",   label: "Submit"   },
    { key: "confirmed", label: "Complete" },
  ];

  const idx = step === "failed" ? -1 : steps.findIndex(s => s.key === step);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done    = idx > i;
        const active  = idx === i;
        const pending = idx < i;

        return (
          <React.Fragment key={s.key}>
            <div className="flex items-center gap-1.5">
              <motion.div
                animate={{
                  backgroundColor: done ? "#22c55e" : active ? "#D4AF37" : "rgba(255,255,255,0.05)",
                  borderColor:     done ? "#22c55e" : active ? "#D4AF37" : "rgba(212,175,55,0.15)",
                }}
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-black"
              >
                {done ? (
                  <CheckCircle2 size={12} className="text-[#0F0F0F]" />
                ) : (
                  <span className={active ? "text-[#0F0F0F]" : "text-[#F3E5AB]/20"}>{i + 1}</span>
                )}
              </motion.div>
              <span className={`text-[9px] uppercase tracking-widest font-black hidden sm:block ${
                active ? "text-[#D4AF37]" : done ? "text-green-400" : "text-[#F3E5AB]/20"
              }`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px max-w-6 bg-[#D4AF37]/10" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ANIMATED SCORE RING (compact)
// ---------------------------------------------------------------------------

function ScoreRingCompact({ score }: { score: number }) {
  const pct    = score / 100;
  const r      = 16;
  const circ   = 2 * Math.PI * r;
  const dash   = circ * pct;
  const isHigh = pct >= 0.85;
  const isMid  = pct >= 0.50;
  const stroke = isHigh ? "#22c55e" : isMid ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-10 h-10">
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#ffffff08" strokeWidth="3" />
        <motion.circle
          cx="20" cy="20" r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[8px] font-black" style={{ color: stroke }}>
          {(pct * 100).toFixed(0)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PENDING PULSE BAR
// ---------------------------------------------------------------------------

function PendingPulse({ opHash }: { opHash: string | null }) {
  return (
    <div className="space-y-6">
      {/* Animated spinner ring */}
      <div className="flex items-center justify-center">
        <div className="relative w-24 h-24">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-t-[#D4AF37] border-r-[#D4AF37]/30 border-b-transparent border-l-transparent"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 3.2, ease: "linear" }}
            className="absolute inset-3 rounded-full border-2 border-t-transparent border-r-transparent border-b-[#D4AF37]/50 border-l-[#D4AF37]/20"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap size={22} className="text-[#D4AF37]" fill="currentColor" />
          </div>
        </div>
      </div>

      <div className="text-center space-y-2">
        <p className="text-base font-bold text-[#F3E5AB]">Broadcasting to Base L2</p>
        <p className="text-xs text-[#F3E5AB]/40 font-medium">Pimlico paymaster sponsoring gas…</p>
      </div>

      {/* Pulsing progress bar */}
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB]"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          style={{ width: "60%" }}
        />
      </div>

      {opHash && (
        <div className="bg-[#0F0F0F] rounded-2xl px-4 py-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]/50 mb-1">UserOp Hash</p>
          <p className="text-[11px] font-mono text-[#F3E5AB]/50 break-all">{opHash}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]/60">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Confirming · EIP-4337 Bundler
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CONFIRMATION SEAL
// ---------------------------------------------------------------------------

function ConfirmationSeal({ opHash, onClose }: { opHash: string | null; onClose: () => void }) {
  const PARTICLE_COUNT = 24;
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle  = (i / PARTICLE_COUNT) * Math.PI * 2;
    const radius = i % 2 === 0 ? 120 : 85;
    const size   = i % 3 === 0 ? 8 : 5;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, size, delay: 0.12 + (i % 6) * 0.03 };
  });

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      <div className="relative flex items-center justify-center">
        {/* Particle burst */}
        {particles.map((p, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: p.delay }}
            style={{ width: p.size, height: p.size }}
            className="absolute rounded-full bg-[#D4AF37]"
          />
        ))}

        {/* Ring flash */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0.7 }}
          animate={{ scale: 2.8, opacity: 0 }}
          transition={{ duration: 0.75, ease: "easeOut", delay: 0.1 }}
          className="absolute w-32 h-32 rounded-full border border-[#D4AF37]/50"
        />

        {/* Seal */}
        <motion.div
          initial={{ scale: 3.5, rotate: -50, opacity: 0 }}
          animate={{ scale: 1, rotate: -10, opacity: 1 }}
          transition={{ type: "spring", damping: 10, stiffness: 100, delay: 0.1 }}
        >
          <div className="w-48 h-48 rounded-full border-[6px] border-[#D4AF37]/30 flex items-center justify-center">
            <div className="w-[calc(100%-16px)] h-[calc(100%-16px)] rounded-full border-2 border-[#D4AF37]/50 bg-gradient-to-br from-[#D4AF37]/8 to-transparent flex flex-col items-center justify-center gap-1.5">
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 9, stiffness: 220, delay: 0.45 }}
              >
                <CheckCircle2 size={28} className="text-[#D4AF37]" strokeWidth={2} />
              </motion.div>
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-[#D4AF37] font-serif text-xl font-black tracking-tight"
              >
                PROPOSED
              </motion.span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.72 }}
                className="text-[#D4AF37]/40 text-[8px] uppercase tracking-[0.3em]"
              >
                Kula Protocol
              </motion.span>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        className="text-center space-y-2"
      >
        <p className="text-lg font-bold text-[#F3E5AB]">Acquisition Proposed On-Chain</p>
        <p className="text-xs text-[#F3E5AB]/40">Group members can now vote on this proposal</p>
      </motion.div>

      {opHash && (
        <motion.a
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.95 }}
          href={`https://sepolia.basescan.org/tx/${opHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-[#D4AF37]/60 hover:text-[#D4AF37] transition-colors font-bold uppercase tracking-widest"
        >
          <ExternalLink size={12} /> View on BaseScan
        </motion.a>
      )}

      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={onClose}
        className="w-full py-4 bg-[#D4AF37] text-[#0F0F0F] font-black text-xs uppercase tracking-[0.25em] rounded-2xl shadow-[0_8px_24px_rgba(212,175,55,0.25)]"
      >
        Return to Marketplace
      </motion.button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ASSET SUMMARY ROW
// ---------------------------------------------------------------------------

function AssetSummary({ asset }: { asset: RWAAsset }) {
  const [expanded, setExpanded] = useState(false);
  const pct = asset.oracleScore / 100;
  const isHigh = pct >= 0.85;

  return (
    <div className="bg-[#0F0F0F] rounded-2xl border border-[#D4AF37]/8 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 p-5 text-left"
      >
        <div className="p-2.5 bg-[#D4AF37]/8 rounded-xl flex-shrink-0">
          {ASSET_TYPE_ICON[asset.assetType]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#F3E5AB] truncate text-sm">{asset.title}</p>
          <p className="text-[9px] uppercase tracking-widest text-[#D4AF37]/40 font-black mt-0.5">
            Asset #{asset.id} · {bigIntToUsdc(asset.askPrice)} USDC ask
          </p>
        </div>
        <ScoreRingCompact score={asset.oracleScore} />
        {expanded ? <ChevronUp size={14} className="text-[#D4AF37]/40 flex-shrink-0" /> : <ChevronDown size={14} className="text-[#D4AF37]/40 flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3 border-t border-[#D4AF37]/8 pt-4">
              {/* Oracle score detail */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#F3E5AB]/30">AI Oracle Score</span>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-bold ${
                  isHigh ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                }`}>
                  {isHigh ? <BadgeCheck size={10} /> : <AlertTriangle size={10} />}
                  {pct.toFixed(2)} / 1.00
                </div>
              </div>

              {/* Poster */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#F3E5AB]/30">Posted By</span>
                <span className="text-xs font-mono text-[#F3E5AB]/50">{shortenAddr(asset.poster)}</span>
              </div>

              {/* Community trust */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#F3E5AB]/30">Community Trust</span>
                <span className="text-xs font-mono text-[#D4AF37]">{asset.communityTrustScore} / 100</span>
              </div>

              {/* Document link */}
              {asset.documentCid && (
                <a
                  href={ipfsUrl(asset.documentCid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] text-[#D4AF37]/60 hover:text-[#D4AF37] transition-colors font-bold uppercase tracking-widest"
                >
                  <ExternalLink size={10} /> View IPFS Document
                </a>
              )}

              {/* Status */}
              <div className="flex items-center gap-2">
                {asset.isVerified ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold">
                    <ShieldCheck size={10} /> Oracle Verified ✓
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold">
                    <AlertTriangle size={10} /> Pending Verification
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FORM FIELDS
// ---------------------------------------------------------------------------

interface FormState {
  description:    string;
  amountStr:      string;
}

const DESCRIPTION_PLACEHOLDERS = [
  "The Kitengela 5-acre parcel aligns with our 2026 land banking strategy…",
  "This vehicle represents a productive yield asset for group rental income…",
  "Acquiring this title deed diversifies our RWA portfolio into Mombasa…",
];

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

interface PurchaseExecutionProps {
  asset:     RWAAsset;
  groupId:   number;
  onClose:   () => void;
  onSuccess: (opHash: string) => void;
}

export default function PurchaseExecution({
  asset,
  groupId,
  onClose,
  onSuccess,
}: PurchaseExecutionProps) {
  const smartAccountAddress = useKulaStore(selectSmartAccountAddress);

  const { proposeAsset, isSubmitting, lastOpHash, lastError, pollOpStatus } = useSmartAccount();

  const [step,        setStep]        = useState<Step>("form");
  const [form,        setForm]        = useState<FormState>({ description: "", amountStr: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});
  const [confirmedHash, setConfirmedHash] = useState<string | null>(null);

  const descRef   = useRef<HTMLTextAreaElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const placeholderIdx = useRef(Math.floor(Math.random() * DESCRIPTION_PLACEHOLDERS.length)).current;

  // ── Fetch group treasury balance ─────────────────────────────────────────
  const { data: groupData } = useReadContract({
    address:      ROTARY_ADDRESS,
    abi:          ROTARY_BALANCE_ABI,
    functionName: "groups",
    args:         [BigInt(groupId)],
    chainId:      baseSepolia.id,
    query: { refetchInterval: 15_000 },
  });

  // groupData: [id, name, treasurer, contributionAmount, intervalSeconds, balance, active, ...]
  const groupBalance: bigint = groupData ? (groupData as unknown as bigint[])[5] ?? 0n : 0n;
  const groupName:    string = groupData ? (groupData as unknown as string[])[1]  ?? `Group #${groupId}` : `Group #${groupId}`;

  // ── Escape key guard ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && step === "form") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, onClose]);

  // ── Poll for confirmation once we have a hash ────────────────────────────
  useEffect(() => {
    if (!lastOpHash || step !== "pending") return;

    let attempts = 0;
    const MAX    = 45;
    const POLL   = 4_000;

    const timer = setInterval(async () => {
      attempts++;
      const status = await pollOpStatus(lastOpHash);

      if (status === "CONFIRMED") {
        clearInterval(timer);
        setConfirmedHash(lastOpHash);
        setStep("confirmed");
      } else if (status === "FAILED" || attempts >= MAX) {
        clearInterval(timer);
        setStep("failed");
      }
    }, POLL);

    return () => clearInterval(timer);
  }, [lastOpHash, step, pollOpStatus]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const errors: Partial<FormState> = {};

    if (!form.description.trim()) {
      errors.description = "Please provide a rationale for this proposal.";
    } else if (form.description.length < 20) {
      errors.description = "Description must be at least 20 characters.";
    }

    const amount = usdcToBigInt(form.amountStr);
    if (amount === 0n) {
      errors.amountStr = "Please enter a USDC amount greater than 0.";
    } else if (amount > asset.askPrice) {
      errors.amountStr = `Amount exceeds ask price of ${bigIntToUsdc(asset.askPrice)} USDC.`;
    } else if (groupBalance > 0n && amount > groupBalance) {
      errors.amountStr = `Exceeds group treasury balance of ${bigIntToUsdc(groupBalance)} USDC.`;
    } else if (amount < BigInt(MIN_USDC_AMOUNT * USDC_MULTIPLIER)) {
      errors.amountStr = `Minimum is ${MIN_USDC_AMOUNT} USDC.`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, asset.askPrice, groupBalance]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    if (!smartAccountAddress) return;

    const requestedAmount = usdcToBigInt(form.amountStr);

    setStep("signing");
    const opHash = await proposeAsset(
      groupId,
      asset.id,
      form.description.trim(),
      requestedAmount,
    );

    if (opHash) {
      setStep("pending");
    } else {
      setStep("failed");
    }
  }, [validate, smartAccountAddress, form, groupId, asset.id, proposeAsset]);

  // ── Keyboard submit on Ctrl/Cmd+Enter in description ──────────────────────
  const handleDescKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSubmit();
  };

  // ── Reusable input classes ────────────────────────────────────────────────
  const inputCls = (hasErr: boolean) =>
    `w-full bg-[#0F0F0F] border ${hasErr ? "border-red-500/50 focus:border-red-500" : "border-[#D4AF37]/15 focus:border-[#D4AF37]/40"} rounded-2xl py-4 px-5 text-sm outline-none transition-all placeholder:text-[#F3E5AB]/20 text-[#F3E5AB]`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 sm:p-8"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={step === "form" ? onClose : undefined}
        className="absolute inset-0 bg-[#080808]/90 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 60, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", damping: 22, stiffness: 240 }}
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#1B1212] border border-[#D4AF37]/20 rounded-[2.5rem] shadow-[0_40px_120px_rgba(0,0,0,0.9)] custom-scroll"
      >
        {/* Gold top strip */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-60 rounded-t-[2.5rem]" />

        <div className="p-8 space-y-7">
          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 bg-[#D4AF37]/10 rounded-xl border border-[#D4AF37]/15">
                  <Gavel size={16} className="text-[#D4AF37]" />
                </div>
                <h2 className="text-xl font-serif text-[#F3E5AB]">Propose Acquisition</h2>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]/40">
                Gasless · EIP-4337 · Base Sepolia
              </p>
            </div>
            {step === "form" && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors flex-shrink-0"
              >
                <X size={18} className="text-[#F3E5AB]/40" />
              </button>
            )}
          </div>

          {/* ── Step indicator ──────────────────────────────────────── */}
          <StepIndicator step={step} />

          {/* ── Conditional body ────────────────────────────────────── */}
          <AnimatePresence mode="wait">

            {/* FORM ────────────────────────────────────────────────── */}
            {step === "form" && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-6"
              >
                {/* Asset summary */}
                <AssetSummary asset={asset} />

                {/* Group + treasury */}
                <div className="flex items-center justify-between px-5 py-4 bg-[#0F0F0F] rounded-2xl border border-[#D4AF37]/8">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]/40 mb-1">Proposing for</p>
                    <p className="text-sm font-bold text-[#D4AF37]">{groupName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]/40 mb-1">Group Treasury</p>
                    <p className="text-sm font-bold text-[#F3E5AB]">
                      {groupBalance > 0n ? `${bigIntToUsdc(groupBalance)} USDC` : "—"}
                    </p>
                  </div>
                </div>

                {/* Requested amount */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#D4AF37]/60 mb-2">
                    Requested Amount (USDC) *
                  </label>
                  <div className="relative">
                    <DollarSign size={15} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#D4AF37]/40 pointer-events-none" />
                    <input
                      ref={amountRef}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={`Max ${bigIntToUsdc(asset.askPrice)}`}
                      value={form.amountStr}
                      onChange={e => {
                        setForm(f => ({ ...f, amountStr: e.target.value }));
                        if (fieldErrors.amountStr) setFieldErrors(fe => ({ ...fe, amountStr: undefined }));
                      }}
                      className={`${inputCls(!!fieldErrors.amountStr)} pl-11`}
                    />
                  </div>

                  {/* Quick-fill shortcuts */}
                  <div className="flex gap-2 mt-2">
                    {[25, 50, 75, 100].map(pct => {
                      const val = (Number(asset.askPrice) * pct / 100 / USDC_MULTIPLIER).toFixed(2);
                      return (
                        <button
                          key={pct}
                          onClick={() => setForm(f => ({ ...f, amountStr: val }))}
                          className="flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10 border border-[#D4AF37]/10 rounded-xl text-[#D4AF37]/60 hover:text-[#D4AF37]/80 transition-all"
                        >
                          {pct}%
                        </button>
                      );
                    })}
                  </div>

                  {fieldErrors.amountStr && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                      <AlertTriangle size={11} /> {fieldErrors.amountStr}
                    </p>
                  )}
                </div>

                {/* Proposal description */}
                <div>
                  <label className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#D4AF37]/60 mb-2">
                    <span>Acquisition Rationale *</span>
                    <span className={`font-mono ${form.description.length > MAX_DESCRIPTION * 0.85 ? "text-amber-400" : "text-[#F3E5AB]/20"}`}>
                      {form.description.length}/{MAX_DESCRIPTION}
                    </span>
                  </label>
                  <textarea
                    ref={descRef}
                    rows={4}
                    maxLength={MAX_DESCRIPTION}
                    placeholder={DESCRIPTION_PLACEHOLDERS[placeholderIdx]}
                    value={form.description}
                    onChange={e => {
                      setForm(f => ({ ...f, description: e.target.value }));
                      if (fieldErrors.description) setFieldErrors(fe => ({ ...fe, description: undefined }));
                    }}
                    onKeyDown={handleDescKeyDown}
                    className={`${inputCls(!!fieldErrors.description)} resize-none leading-relaxed`}
                  />
                  {fieldErrors.description && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                      <AlertTriangle size={11} /> {fieldErrors.description}
                    </p>
                  )}
                  <p className="mt-1.5 text-[9px] text-[#F3E5AB]/25 flex items-center gap-1">
                    <Info size={9} /> Ctrl+Enter to submit · visible to all group members on-chain
                  </p>
                </div>

                {/* Oracle warning if score < 0.85 */}
                {asset.oracleScore < 85 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-3 px-4 py-4 bg-amber-500/8 border border-amber-500/20 rounded-2xl"
                  >
                    <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-400 mb-1">Oracle Score Below Threshold</p>
                      <p className="text-[10px] text-amber-400/70 leading-relaxed">
                        This asset's AI Oracle score ({(asset.oracleScore / 100).toFixed(2)}) is below the 0.85 verified threshold.
                        The proposal can still be submitted, but group members should review the documentation carefully.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Submit */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full py-5 bg-[#D4AF37] hover:bg-[#c9a62e] text-[#0F0F0F] font-black text-xs uppercase tracking-[0.3em] rounded-2xl transition-all flex items-center justify-center gap-3 shadow-[0_8px_28px_rgba(212,175,55,0.3)] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Preparing…</>
                  ) : (
                    <><Gavel size={15} /> Submit Gasless Proposal</>
                  )}
                </motion.button>

                <p className="text-center text-[9px] text-[#F3E5AB]/20 font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <Zap size={9} className="text-green-400" fill="currentColor" />
                  Gas sponsored by Pimlico paymaster · no ETH required
                </p>
              </motion.div>
            )}

            {/* SIGNING ─────────────────────────────────────────────── */}
            {step === "signing" && (
              <motion.div
                key="signing"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="py-8 flex flex-col items-center gap-6 text-center"
              >
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="w-16 h-16 rounded-full border-2 border-t-[#D4AF37] border-r-[#D4AF37]/20 border-b-transparent border-l-transparent"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileText size={20} className="text-[#D4AF37]/60" />
                  </div>
                </div>
                <div>
                  <p className="text-base font-bold text-[#F3E5AB] mb-2">Awaiting Signature</p>
                  <p className="text-xs text-[#F3E5AB]/40 leading-relaxed max-w-xs">
                    Sign the UserOperation in your Privy embedded wallet to authorise this proposal gaslessly.
                  </p>
                </div>
                <div className="px-5 py-4 bg-[#0F0F0F] rounded-2xl border border-[#D4AF37]/8 w-full text-left space-y-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="font-black uppercase tracking-widest text-[#D4AF37]/40">Asset</span>
                    <span className="text-[#F3E5AB]/60 truncate max-w-[60%]">{asset.title}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="font-black uppercase tracking-widest text-[#D4AF37]/40">Amount</span>
                    <span className="text-[#D4AF37] font-bold">{form.amountStr} USDC</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="font-black uppercase tracking-widest text-[#D4AF37]/40">Group</span>
                    <span className="text-[#F3E5AB]/60">{groupName}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PENDING ──────────────────────────────────────────────── */}
            {step === "pending" && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="py-6"
              >
                <PendingPulse opHash={lastOpHash} />
              </motion.div>
            )}

            {/* CONFIRMED ────────────────────────────────────────────── */}
            {step === "confirmed" && (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <ConfirmationSeal
                  opHash={confirmedHash}
                  onClose={() => {
                    onSuccess(confirmedHash ?? "");
                  }}
                />
              </motion.div>
            )}

            {/* FAILED ───────────────────────────────────────────────── */}
            {step === "failed" && (
              <motion.div
                key="failed"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="py-8 flex flex-col items-center gap-6 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center">
                  <AlertTriangle size={32} className="text-red-400" />
                </div>
                <div>
                  <p className="text-base font-bold text-[#F3E5AB] mb-2">Transaction Failed</p>
                  <p className="text-xs text-[#F3E5AB]/40 leading-relaxed max-w-xs">
                    {lastError ?? "The UserOperation could not be confirmed. Please check your balance and try again."}
                  </p>
                </div>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={onClose}
                    className="flex-1 py-4 border border-[#D4AF37]/15 text-[#F3E5AB]/50 font-bold text-xs uppercase tracking-widest rounded-2xl hover:border-[#D4AF37]/30 hover:text-[#F3E5AB]/70 transition-all"
                  >
                    Close
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStep("form")}
                    className="flex-1 py-4 bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#D4AF37]/15 transition-all"
                  >
                    Try Again
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
