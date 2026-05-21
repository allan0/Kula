"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring,
} from "framer-motion";
import { Timer, Check, X, Landmark, User, Zap } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPE AUGMENTATION — Telegram WebApp global
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  setBackgroundColor: (color: string) => void;
  setHeaderColor: (color: string) => void;
  HapticFeedback?: {
    impactOccurred: (
      style: "light" | "medium" | "heavy" | "rigid" | "soft"
    ) => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  MainButton?: {
    setText: (text: string) => void;
    setParams: (params: {
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
    show: () => void;
    hide: () => void;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TMA HOOK — safe accessor, no side effects
// ─────────────────────────────────────────────────────────────────────────────
function useTMA() {
  const getTg = (): TelegramWebApp | null =>
    typeof window !== "undefined" ? window.Telegram?.WebApp ?? null : null;

  return {
    getTg,
    haptic: {
      impact: (
        style: "light" | "medium" | "heavy" | "rigid" | "soft" = "heavy"
      ) => getTg()?.HapticFeedback?.impactOccurred(style),
      notification: (type: "error" | "success" | "warning") =>
        getTg()?.HapticFeedback?.notificationOccurred(type),
      selection: () => getTg()?.HapticFeedback?.selectionChanged(),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Proposal {
  id: string;
  assetName: string;
  proposer: string;
  amount: string;
  timeLeft: string;
  quorum: number;
  image: string;
}

const DUMMY_PROPOSALS: Proposal[] = [
  {
    id: "1",
    assetName: "Kitengela Prime 5A",
    proposer: "0x71...88a2",
    amount: "45,000 USDC",
    timeLeft: "14h 22m",
    quorum: 65,
    image:
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "2",
    assetName: "Rare Highland Cask #4",
    proposer: "0x94...11b0",
    amount: "12,500 USDC",
    timeLeft: "2d 04h",
    quorum: 20,
    image:
      "https://images.unsplash.com/photo-1527281405622-49420016e37b?auto=format&fit=crop&w=800&q=80",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// VOTING HALL — orchestrator component
// ─────────────────────────────────────────────────────────────────────────────
export default function VotingHall() {
  const [proposals, setProposals] = useState<Proposal[]>(DUMMY_PROPOSALS);
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const { getTg, haptic } = useTMA();

  // ── TMA setup + MainButton wiring ──────────────────────────────────────────
  useEffect(() => {
    const tg = getTg();
    if (!tg) return;
    tg.ready();
    tg.expand();
    tg.setBackgroundColor("#0F0F0F");
    tg.setHeaderColor("#0F0F0F");
  }, []);

  const topProposalId = proposals[proposals.length - 1]?.id;

  useEffect(() => {
    const tg = getTg();
    if (!tg?.MainButton) return;

    if (!topProposalId) {
      tg.MainButton.hide();
      return;
    }

    const handler = () => {
      tg.HapticFeedback?.impactOccurred("heavy");
      setApprovedId(topProposalId);
      // Let the card's seal animation play, then clean up
      setTimeout(() => {
        setProposals((prev) => prev.filter((p) => p.id !== topProposalId));
        setApprovedId(null);
      }, 1700);
    };

    tg.MainButton.setText("⚡  APPROVE PROPOSAL");
    tg.MainButton.setParams({
      color: "#D4AF37",
      text_color: "#0F0F0F",
      is_active: true,
      is_visible: true,
    });
    tg.MainButton.onClick(handler);
    tg.MainButton.show();

    return () => {
      tg.MainButton?.offClick(handler);
      tg.MainButton?.hide();
    };
  }, [topProposalId]);

  const handleRemoveCard = useCallback((id: string) => {
    setProposals((prev) => prev.filter((p) => p.id !== id));
    setApprovedId(null);
  }, []);

  return (
    <div className="relative w-full h-[620px] flex flex-col items-center justify-start overflow-hidden">
      {/* Section header */}
      <div className="text-center mb-10 pt-4">
        <h2 className="text-gold font-serif text-3xl mb-2 italic">
          The Voting Hall
        </h2>
        <p className="text-gold/50 text-xs uppercase tracking-[0.3em]">
          Sovereign Decision Layer
        </p>
      </div>

      {/* Card stack container */}
      <div className="relative w-full max-w-sm h-[460px]">
        <AnimatePresence>
          {proposals.map((proposal, index) => {
            // stackDepth: 0 = top card, 1 = second, etc.
            const stackDepth = proposals.length - 1 - index;
            return (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                isTop={stackDepth === 0}
                stackDepth={stackDepth}
                isExternallyApproved={approvedId === proposal.id}
                onVeto={() => {
                  haptic.notification("error");
                  handleRemoveCard(proposal.id);
                }}
                onApprove={() => {
                  haptic.impact("heavy");
                  setTimeout(() => handleRemoveCard(proposal.id), 1700);
                }}
                haptic={haptic}
              />
            );
          })}
        </AnimatePresence>

        {/* Empty state */}
        <AnimatePresence>
          {proposals.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                delay: 0.35,
                type: "spring",
                damping: 22,
                stiffness: 180,
              }}
              className="flex flex-col items-center justify-center h-full border border-gold/10 rounded-[2.5rem] bg-[#1B1212]/30 backdrop-blur-sm"
            >
              <Landmark
                className="text-gold/15 mb-5"
                size={52}
                strokeWidth={1}
              />
              <p className="text-gold/50 font-serif italic text-xl mb-2">
                The Hall is quiet...
              </p>
              <p className="text-gold/20 text-[10px] uppercase tracking-[0.3em]">
                All proposals reviewed
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Swipe instruction hint */}
      <AnimatePresence>
        {proposals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 2 }}
            className="absolute bottom-3 flex gap-10"
          >
            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-gold/20">
              <X size={8} /> Veto
            </span>
            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-gold/20">
              <Check size={8} /> Approve
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPOSAL CARD
// ─────────────────────────────────────────────────────────────────────────────
type HapticApi = ReturnType<typeof useTMA>["haptic"];

function ProposalCard({
  proposal,
  isTop,
  stackDepth,
  isExternallyApproved,
  onVeto,
  onApprove,
  haptic,
}: {
  proposal: Proposal;
  isTop: boolean;
  stackDepth: number;
  isExternallyApproved: boolean;
  onVeto: () => void;
  onApprove: () => void;
  haptic: HapticApi;
}) {
  const [isApproved, setIsApproved] = useState(false);
  const dragThresholdCrossedRef = useRef(false);

  // External approval (e.g. from TMA MainButton)
  useEffect(() => {
    if (isExternallyApproved && !isApproved) {
      setIsApproved(true);
    }
  }, [isExternallyApproved]);

  // ── Motion values ──────────────────────────────────────────────────────────
  const x = useMotionValue(0);

  // Visual transforms
  const rotate = useTransform(x, [-220, 0, 220], [-20, 0, 20]);
  const cardOpacity = useTransform(x, [-260, -120, 0, 120, 260], [0, 1, 1, 1, 0]);

  // Decision overlay opacities — fade in directionally
  const approveOverlayOpacity = useTransform(x, [15, 100], [0, 1]);
  const vetoOverlayOpacity = useTransform(x, [-100, -15], [1, 0]);

  // Background tint shifts with drag direction
  const approveTintOpacity = useTransform(x, [0, 200], [0, 0.11]);
  const vetoTintOpacity = useTransform(x, [-200, 0], [0.14, 0]);

  // ── Stack positioning ──────────────────────────────────────────────────────
  const stackY = stackDepth * 13;
  const stackScale = 1 - stackDepth * 0.045;
  const stackOpacity = stackDepth === 0 ? 1 : stackDepth === 1 ? 0.65 : 0.35;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleApprove = useCallback(() => {
    if (isApproved) return;
    haptic.impact("heavy");
    setIsApproved(true);
    onApprove();
  }, [isApproved, haptic, onApprove]);

  const handleVeto = useCallback(() => {
    if (isApproved) return;
    haptic.notification("error");
    onVeto();
  }, [isApproved, haptic, onVeto]);

  return (
    <motion.div
      className={`absolute inset-0 ${
        isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
      }`}
      style={{
        zIndex: 50 - stackDepth,
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? cardOpacity : stackOpacity,
        y: isTop ? 0 : stackY,
        scale: isTop ? 1 : stackScale,
      }}
      drag={isTop && !isApproved ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.15}
      dragMomentum={false}
      onDrag={(_, info) => {
        // Fire selection haptic on threshold crossing (both ways)
        const nowCrossed = Math.abs(info.offset.x) > 80;
        if (nowCrossed !== dragThresholdCrossedRef.current) {
          haptic.selection();
          dragThresholdCrossedRef.current = nowCrossed;
        }
      }}
      onDragEnd={(_, info) => {
        dragThresholdCrossedRef.current = false;
        const { offset, velocity } = info;
        const isFlick = Math.abs(velocity.x) > 700;

        if (offset.x > 110 || (isFlick && offset.x > 30)) {
          handleApprove();
        } else if (offset.x < -110 || (isFlick && offset.x < -30)) {
          handleVeto();
        }
      }}
      initial={{ scale: stackScale, y: stackY + 22, opacity: 0 }}
      animate={{
        scale: isTop ? 1 : stackScale,
        y: isTop ? 0 : stackY,
        opacity: isTop ? 1 : stackOpacity,
      }}
      exit={{
        x: isApproved ? 600 : -600,
        rotate: isApproved ? 18 : -18,
        opacity: 0,
        scale: 0.88,
        transition: { duration: 0.5, ease: [0.32, 0, 0.67, 0] },
      }}
      transition={{ type: "spring", damping: 22, stiffness: 200, mass: 0.75 }}
    >
      {/* ── Card surface ──────────────────────────────────────────────────── */}
      <div className="relative w-full h-full bg-[#1B1212] border border-gold/20 rounded-[2.5rem] overflow-hidden shadow-2xl">

        {/* Approve tint */}
        <motion.div
          className="absolute inset-0 rounded-[2.5rem] pointer-events-none z-10"
          style={{
            background: "radial-gradient(circle, rgba(34,197,94,1), transparent 70%)",
            opacity: isTop ? approveTintOpacity : 0,
          }}
        />
        {/* Veto tint */}
        <motion.div
          className="absolute inset-0 rounded-[2.5rem] pointer-events-none z-10"
          style={{
            background: "radial-gradient(circle, rgba(239,68,68,1), transparent 70%)",
            opacity: isTop ? vetoTintOpacity : 0,
          }}
        />

        {/* APPROVE badge */}
        {isTop && (
          <motion.div
            className="absolute top-8 right-6 z-20 flex items-center gap-2 border-[3px] border-green-400 px-3 py-1.5 rounded-2xl"
            style={{ opacity: approveOverlayOpacity, rotate: "-11deg" }}
          >
            <Check size={17} className="text-green-400" strokeWidth={3} />
            <span className="text-green-400 font-black text-sm uppercase tracking-wider">
              APPROVE
            </span>
          </motion.div>
        )}

        {/* VETO badge */}
        {isTop && (
          <motion.div
            className="absolute top-8 left-6 z-20 flex items-center gap-2 border-[3px] border-red-400 px-3 py-1.5 rounded-2xl"
            style={{ opacity: vetoOverlayOpacity, rotate: "11deg" }}
          >
            <X size={17} className="text-red-400" strokeWidth={3} />
            <span className="text-red-400 font-black text-sm uppercase tracking-wider">
              VETO
            </span>
          </motion.div>
        )}

        {/* ── Content / Seal toggle ─────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {!isApproved ? (
            <CardContent
              key="content"
              proposal={proposal}
              isTop={isTop}
              onApprove={handleApprove}
              onVeto={handleVeto}
            />
          ) : (
            <ApprovalSeal key="seal" />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD CONTENT
// ─────────────────────────────────────────────────────────────────────────────
function CardContent({
  proposal,
  isTop,
  onApprove,
  onVeto,
}: {
  proposal: Proposal;
  isTop: boolean;
  onApprove: () => void;
  onVeto: () => void;
}) {
  return (
    <motion.div
      className="absolute inset-0 p-6 flex flex-col"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      {/* Asset image */}
      <div className="relative h-44 w-full rounded-2xl overflow-hidden mb-5 border border-gold/10 shrink-0">
        <img
          src={proposal.image}
          alt={proposal.assetName}
          className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1B1212]/70 to-transparent" />

        {/* Timer badge */}
        <div className="absolute top-3.5 right-3.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-gold/30 flex items-center gap-1.5">
          <motion.div
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-1.5 h-1.5 bg-amber-400 rounded-full"
          />
          <Timer size={11} className="text-gold" />
          <span className="text-gold text-[10px] font-bold tracking-wider">
            {proposal.timeLeft}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-gold-light font-serif text-xl mb-1 leading-tight">
          {proposal.assetName}
        </h3>
        <div className="flex items-center gap-1.5 mb-4">
          <User size={10} className="text-gold/40" />
          <span className="text-gold/40 text-[9px] uppercase tracking-widest">
            Proposed by {proposal.proposer}
          </span>
        </div>

        <div className="flex justify-between items-baseline mb-3">
          <span className="text-gold/50 text-[9px] uppercase tracking-tighter">
            Required Funds
          </span>
          <span className="text-gold text-xl font-bold">{proposal.amount}</span>
        </div>

        {/* Quorum progress */}
        <div className="w-full h-0.5 bg-gold/10 rounded-full overflow-hidden mb-1.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${proposal.quorum}%` }}
            transition={{
              duration: 1.5,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.4,
            }}
            className={`h-full rounded-full ${
              proposal.quorum >= 80 ? "bg-green-400" : "bg-gold"
            }`}
          />
        </div>
        <div className="flex justify-between mb-5">
          <span className="text-[9px] text-gold/30 uppercase tracking-widest">
            Quorum Progress
          </span>
          <span
            className={`text-[9px] font-bold ${
              proposal.quorum >= 80 ? "text-green-400" : "text-gold"
            }`}
          >
            {proposal.quorum}% / 80%
          </span>
        </div>

        {/* CTA (only visible on top card) */}
        {isTop && (
          <div className="flex gap-3 mt-auto">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onVeto}
              className="flex-1 flex items-center justify-center py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/25 hover:border-red-500/25 hover:text-red-400/60 transition-colors"
            >
              <X size={16} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onApprove}
              className="flex-[3] flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gold text-[#0F0F0F] font-black uppercase text-[10px] tracking-widest shadow-[0_0_22px_rgba(212,175,55,0.3)] hover:shadow-[0_0_38px_rgba(212,175,55,0.5)] transition-shadow"
            >
              <Zap size={13} fill="currentColor" /> Approve
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVAL SEAL — cinematic stamp animation with gold particle burst
// ─────────────────────────────────────────────────────────────────────────────
function ApprovalSeal() {
  // 20 particles at evenly distributed angles, alternating two radii
  const PARTICLE_COUNT = 20;
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
    const radius = i % 2 === 0 ? 158 : 108;
    const size = i % 3 === 0 ? 10 : 6;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      size,
      delay: 0.15 + (i % 5) * 0.04,
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 flex items-center justify-center bg-[#080808]/96 rounded-[2.5rem]"
    >
      <div className="relative flex items-center justify-center">
        {/* Gold particle burst */}
        {particles.map((p, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
            transition={{
              duration: 1.05,
              ease: [0.22, 1, 0.36, 1],
              delay: p.delay,
            }}
            style={{ width: p.size, height: p.size }}
            className="absolute bg-gold rounded-full"
          />
        ))}

        {/* Outer ring flash */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0.8 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          className="absolute w-48 h-48 rounded-full border border-gold/60"
        />

        {/* The Seal — stamps in from scale:4 */}
        <motion.div
          initial={{ scale: 4, rotate: -45, opacity: 0 }}
          animate={{ scale: 1, rotate: -12, opacity: 1 }}
          transition={{
            type: "spring",
            damping: 10,
            stiffness: 110,
            delay: 0.12,
          }}
        >
          <div className="w-56 h-56 rounded-full border-[7px] border-gold/35 flex items-center justify-center">
            <div className="w-[calc(100%-18px)] h-[calc(100%-18px)] rounded-full border-2 border-gold/55 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-gold/8 to-transparent">
              {/* Checkmark stamps in with its own spring */}
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  damping: 9,
                  stiffness: 220,
                  delay: 0.4,
                }}
              >
                <Check size={30} className="text-gold" strokeWidth={2.5} />
              </motion.div>
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.3 }}
                className="text-gold font-serif text-[22px] font-black tracking-tight leading-none"
              >
                APPROVED
              </motion.span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-gold/40 text-[8px] uppercase tracking-[0.3em]"
              >
                Sovereign Council
              </motion.span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
