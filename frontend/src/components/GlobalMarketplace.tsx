// FILE: frontend/src/components/GlobalMarketplace.tsx
// PURPOSE: Browse AI-oracle-verified RWAs from KulaPublicRegistry.sol.
//          Group members can propose buying an asset (proposeAsset via
//          useSmartAccount) and vote on existing proposals (voteOnAsset).
//
// DATA FLOW:
//   1. useReadContracts polls KulaPublicRegistry for all listed assets
//   2. Each asset card shows AI Oracle authenticity score + status badge
//   3. "Propose Acquisition" opens PurchaseExecution modal → proposeAsset()
//   4. Existing proposals show live vote tallies + voteOnAsset() buttons
//   5. All on-chain writes are gasless via useSmartAccount → Pimlico paymaster
//
// DESIGN: "Dark Luxury" — obsidian/gold. Framer Motion for all transitions.

"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Search,
  SlidersHorizontal,
  Landmark,
  Car,
  FileText,
  ExternalLink,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Zap,
  TrendingUp,
  RefreshCw,
  X,
  Info,
  BadgeCheck,
  Gavel,
  Eye,
} from "lucide-react";
import { useReadContracts, useReadContract, useBlockNumber } from "wagmi";
import { baseSepolia } from "wagmi/chains";

import useKulaStore, {
  selectActiveGroupId,
  selectActiveGroupName,
  selectSmartAccountAddress,
} from "@/store/useKulaStore";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import PurchaseExecution from "./PurchaseExecution";

// ---------------------------------------------------------------------------
// CONTRACT CONFIG
// ---------------------------------------------------------------------------

const REGISTRY_ADDRESS = (
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

const ROTARY_ADDRESS = (
  process.env.NEXT_PUBLIC_ROTARY_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

const REGISTRY_ABI = [
  {
    name: "assetCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAsset",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_assetId", type: "uint256" }],
    outputs: [
      { name: "id",                  type: "uint256" },
      { name: "poster",              type: "address" },
      { name: "title",               type: "string"  },
      { name: "documentCid",         type: "string"  },
      { name: "askPrice",            type: "uint256" },
      { name: "communityTrustScore", type: "uint256" },
      { name: "isVerified_",         type: "bool"    },
      { name: "isMinted",            type: "bool"    },
    ],
  },
  {
    name: "oracleScores",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_assetId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }], // scaled ×100 (e.g. 92 = 0.92)
  },
] as const;

const ROTARY_ABI = [
  {
    name: "assetProposalCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "assetProposals",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      { name: "groupId",           type: "uint256" },
      { name: "registryAssetId",   type: "uint256" },
      { name: "proposer",          type: "address" },
      { name: "description",       type: "string"  },
      { name: "requestedAmount",   type: "uint256" },
      { name: "votesFor",          type: "uint256" },
      { name: "executed",          type: "bool"    },
      { name: "exists",            type: "bool"    },
    ],
  },
  {
    name: "hasVotedOnProposal",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "voter",      type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface RWAAsset {
  id:                  number;
  poster:              string;
  title:               string;
  documentCid:         string;
  askPrice:            bigint;
  communityTrustScore: number;
  isVerified:          boolean;
  isMinted:            boolean;
  oracleScore:         number;   // 0–100 (integer, stored as ×100 on-chain)
  assetType:           "land_deed" | "vehicle_logbook" | "title_certificate" | "other";
}

interface AssetProposal {
  proposalId:      number;
  groupId:         number;
  registryAssetId: number;
  proposer:        string;
  description:     string;
  requestedAmount: bigint;
  votesFor:        number;
  executed:        boolean;
  exists:          boolean;
  hasVoted:        boolean;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

function ipfsUrl(cid: string): string {
  if (!cid || cid.length < 5) return "";
  if (cid.startsWith("http")) return cid;
  return `${IPFS_GATEWAY}${cid}`;
}

function formatUsdc(raw: bigint): string {
  if (!raw) return "0.00";
  const whole = raw / 1_000_000n;
  const frac  = (raw % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole.toLocaleString()}.${frac}`;
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Infer asset type from title heuristic (oracle type would come from metadata)
function inferAssetType(title: string): RWAAsset["assetType"] {
  const t = title.toLowerCase();
  if (t.includes("land") || t.includes("plot") || t.includes("deed") || t.includes("acre")) return "land_deed";
  if (t.includes("vehicle") || t.includes("car") || t.includes("truck") || t.includes("logbook")) return "vehicle_logbook";
  if (t.includes("title") || t.includes("certificate")) return "title_certificate";
  return "other";
}

const ASSET_TYPE_ICON: Record<RWAAsset["assetType"], React.ReactNode> = {
  land_deed:         <Landmark size={20} className="text-[#D4AF37]" />,
  vehicle_logbook:   <Car      size={20} className="text-[#D4AF37]" />,
  title_certificate: <FileText size={20} className="text-[#D4AF37]" />,
  other:             <FileText size={20} className="text-[#D4AF37]" />,
};

const ASSET_TYPE_LABEL: Record<RWAAsset["assetType"], string> = {
  land_deed:         "Land Deed",
  vehicle_logbook:   "Vehicle Logbook",
  title_certificate: "Title Certificate",
  other:             "Document",
};

// ---------------------------------------------------------------------------
// ORACLE SCORE BADGE
// ---------------------------------------------------------------------------

function OracleScoreBadge({ score }: { score: number }) {
  const pct    = score / 100;
  const isHigh = pct >= 0.85;
  const isMid  = pct >= 0.50 && pct < 0.85;

  const color = isHigh ? "#22c55e" : isMid ? "#f59e0b" : "#ef4444";
  const bg    = isHigh ? "bg-green-500/10 border-green-500/25" : isMid ? "bg-amber-500/10 border-amber-500/25" : "bg-red-500/10 border-red-500/25";
  const label = isHigh ? "Oracle Verified"  : isMid ? "Under Review" : "Low Trust";
  const Icon  = isHigh ? BadgeCheck : isMid ? Eye : AlertTriangle;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${bg}`} style={{ color }}>
      <Icon size={12} />
      <span className="uppercase tracking-wider">{label}</span>
      <span className="font-mono ml-1 opacity-80">{pct.toFixed(2)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SCORE RING
// ---------------------------------------------------------------------------

function ScoreRing({ score }: { score: number }) {
  const pct   = score / 100;
  const r     = 22;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * pct;
  const isHigh = pct >= 0.85;
  const isMid  = pct >= 0.50;
  const stroke = isHigh ? "#22c55e" : isMid ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#ffffff08" strokeWidth="4" />
        <motion.circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black" style={{ color: stroke }}>
          {pct.toFixed(2).replace("0.", ".")}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VOTE BAR
// ---------------------------------------------------------------------------

function VoteBar({ votesFor, totalMembers }: { votesFor: number; totalMembers: number }) {
  const pct = totalMembers > 0 ? (votesFor / totalMembers) * 100 : 0;
  const passed = pct > 50;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1.5">
        <span className="text-[#F3E5AB]/50">{votesFor} votes for</span>
        <span className={passed ? "text-green-400" : "text-[#D4AF37]/60"}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: passed ? "#22c55e" : "#D4AF37" }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
      {pct >= 50 && (
        <p className="text-[9px] text-green-400 uppercase tracking-widest mt-1.5 flex items-center gap-1">
          <Zap size={9} fill="currentColor" /> Threshold reached
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ASSET CARD
// ---------------------------------------------------------------------------

interface AssetCardProps {
  asset:     RWAAsset;
  proposals: AssetProposal[];
  groupId:   number | null;
  onPropose: (asset: RWAAsset) => void;
  onVote:    (proposalId: number, support: boolean) => void;
  votingId:  number | null;
}

function AssetCard({ asset, proposals, groupId, onPropose, onVote, votingId }: AssetCardProps) {
  const ref     = useRef<HTMLDivElement>(null);
  const inView  = useInView(ref, { once: true, margin: "-60px" });
  const [expanded, setExpanded] = useState(false);

  const relevantProposals = proposals.filter(p => p.registryAssetId === asset.id && p.exists && !p.executed);
  const assetType = inferAssetType(asset.title);

  const cardVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <motion.div
      ref={ref}
      variants={cardVariants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className="relative group"
    >
      {/* Gold glow on hover */}
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#D4AF37]/0 to-[#D4AF37]/0 group-hover:from-[#D4AF37]/4 group-hover:to-transparent transition-all duration-500 pointer-events-none" />

      <div className="relative bg-[#1B1212] border border-[#D4AF37]/10 group-hover:border-[#D4AF37]/25 rounded-[2rem] overflow-hidden transition-all duration-300">

        {/* Header strip */}
        <div className="relative h-28 bg-gradient-to-br from-[#2A1F10] to-[#1B1212] flex items-center justify-center overflow-hidden">
          {/* Background texture */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, #D4AF37 0, #D4AF37 1px, transparent 0, transparent 50%)", backgroundSize: "12px 12px" }}
          />
          <div className="relative z-10 p-5 bg-[#D4AF37]/8 rounded-2xl border border-[#D4AF37]/15">
            {ASSET_TYPE_ICON[assetType]}
          </div>

          {/* Verified seal */}
          {asset.isVerified && (
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.5 }}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-green-500/15 border border-green-500/30 rounded-xl"
            >
              <ShieldCheck size={11} className="text-green-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-green-400">Verified</span>
            </motion.div>
          )}

          {/* Minted badge */}
          {asset.isMinted && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-[#0052FF]/15 border border-[#0052FF]/30 rounded-xl">
              <Zap size={10} className="text-[#4d8fff]" fill="currentColor" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#4d8fff]">NFT Minted</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Type label */}
          <p className="text-[9px] font-black uppercase tracking-[0.35em] text-[#D4AF37]/50 mb-2">
            {ASSET_TYPE_LABEL[assetType]}
          </p>

          {/* Title */}
          <h3 className="font-serif text-lg leading-snug text-[#F3E5AB] mb-4 line-clamp-2">
            {asset.title}
          </h3>

          {/* Score + Ask price row */}
          <div className="flex items-center justify-between mb-5">
            <ScoreRing score={asset.oracleScore} />
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-[#D4AF37]/50 font-black mb-1">Ask Price</p>
              <p className="text-2xl font-serif text-[#D4AF37] tracking-tight">
                {formatUsdc(asset.askPrice)}
              </p>
              <p className="text-[10px] text-[#F3E5AB]/40 font-medium">USDC</p>
            </div>
          </div>

          {/* Oracle badge */}
          <OracleScoreBadge score={asset.oracleScore} />

          {/* Trust score */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#F3E5AB]/40">Community Trust</p>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#D4AF37] rounded-full transition-all"
                  style={{ width: `${Math.min(asset.communityTrustScore, 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono text-[#D4AF37]">{asset.communityTrustScore}</span>
            </div>
          </div>

          {/* Poster */}
          <div className="mt-4 pt-4 border-t border-[#D4AF37]/8 flex items-center justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-[#F3E5AB]/30 font-black">Posted by</p>
              <p className="text-xs font-mono text-[#F3E5AB]/50 mt-0.5">{shortenAddr(asset.poster)}</p>
            </div>
            {asset.documentCid && (
              <a
                href={ipfsUrl(asset.documentCid)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-[#D4AF37]/60 hover:text-[#D4AF37] transition-colors font-bold uppercase tracking-widest"
              >
                <ExternalLink size={11} /> View Doc
              </a>
            )}
          </div>

          {/* Active proposals */}
          <AnimatePresence>
            {relevantProposals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5 pt-5 border-t border-[#D4AF37]/10"
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]/60 mb-3 flex items-center gap-2">
                  <Gavel size={10} /> Active Proposals
                </p>
                {relevantProposals.map(p => (
                  <div key={p.proposalId} className="bg-[#0F0F0F] rounded-2xl p-4 mb-3 border border-[#D4AF37]/8">
                    <p className="text-xs text-[#F3E5AB]/70 line-clamp-2 mb-2">{p.description}</p>
                    <p className="text-[10px] text-[#D4AF37]/60 font-bold mb-2">
                      Requesting <span className="text-[#D4AF37]">{formatUsdc(p.requestedAmount)} USDC</span>
                    </p>
                    <VoteBar votesFor={p.votesFor} totalMembers={12} />
                    {!p.hasVoted && groupId && (
                      <div className="mt-3 flex gap-2">
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          onClick={() => onVote(p.proposalId, true)}
                          disabled={votingId === p.proposalId}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 rounded-xl transition-all text-green-400 text-xs font-bold disabled:opacity-40"
                        >
                          {votingId === p.proposalId ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <ThumbsUp size={12} />
                          )}
                          Approve
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          onClick={() => onVote(p.proposalId, false)}
                          disabled={votingId === p.proposalId}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/15 rounded-xl transition-all text-red-400 text-xs font-bold disabled:opacity-40"
                        >
                          {votingId === p.proposalId ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <ThumbsDown size={12} />
                          )}
                          Reject
                        </motion.button>
                      </div>
                    )}
                    {p.hasVoted && (
                      <p className="mt-2 text-[9px] text-[#F3E5AB]/30 uppercase tracking-widest flex items-center gap-1">
                        <ShieldCheck size={9} className="text-green-400" /> Vote recorded
                      </p>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA — only show for verified assets if user is in a group */}
          {asset.isVerified && groupId && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPropose(asset)}
              className="mt-5 w-full py-4 bg-[#D4AF37] hover:bg-[#c9a62e] text-[#0F0F0F] font-black text-xs uppercase tracking-[0.25em] rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(212,175,55,0.25)]"
            >
              <Gavel size={14} /> Propose Acquisition
            </motion.button>
          )}

          {!asset.isVerified && (
            <div className="mt-5 w-full py-4 bg-white/3 border border-[#D4AF37]/8 rounded-2xl flex items-center justify-center gap-2 text-[#F3E5AB]/30 text-xs font-bold uppercase tracking-widest">
              <AlertTriangle size={12} /> Awaiting Oracle Verification
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// FILTER BAR
// ---------------------------------------------------------------------------

type FilterType = "all" | "land_deed" | "vehicle_logbook" | "title_certificate" | "other";
type SortType   = "newest" | "price_asc" | "price_desc" | "trust_desc";

interface FilterBarProps {
  filter:    FilterType;
  sort:      SortType;
  search:    string;
  onFilter:  (f: FilterType) => void;
  onSort:    (s: SortType)   => void;
  onSearch:  (q: string)     => void;
  totalCount: number;
}

const FILTER_OPTS: { key: FilterType; label: string }[] = [
  { key: "all",                label: "All Assets"   },
  { key: "land_deed",          label: "Land Deeds"   },
  { key: "vehicle_logbook",    label: "Vehicles"     },
  { key: "title_certificate",  label: "Titles"       },
];

const SORT_OPTS: { key: SortType; label: string }[] = [
  { key: "newest",     label: "Newest"      },
  { key: "price_asc",  label: "Price ↑"     },
  { key: "price_desc", label: "Price ↓"     },
  { key: "trust_desc", label: "Trust Score" },
];

function FilterBar({ filter, sort, search, onFilter, onSort, onSearch, totalCount }: FilterBarProps) {
  const [sortOpen, setSortOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#D4AF37]/40 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search assets by name, location, type…"
          className="w-full bg-[#1B1212] border border-[#D4AF37]/15 focus:border-[#D4AF37]/40 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none transition-all placeholder:text-[#F3E5AB]/20"
        />
      </div>

      {/* Filters + sort row */}
      <div className="flex items-center gap-3 flex-wrap">
        {FILTER_OPTS.map(opt => (
          <button
            key={opt.key}
            onClick={() => onFilter(opt.key)}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${
              filter === opt.key
                ? "bg-[#D4AF37] text-[#0F0F0F]"
                : "bg-[#1B1212] border border-[#D4AF37]/10 text-[#F3E5AB]/50 hover:border-[#D4AF37]/25 hover:text-[#F3E5AB]/70"
            }`}
          >
            {opt.label}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Asset count */}
        <span className="text-xs text-[#F3E5AB]/30 font-mono">{totalCount} assets</span>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setSortOpen(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1B1212] border border-[#D4AF37]/10 hover:border-[#D4AF37]/25 rounded-2xl text-xs font-bold text-[#F3E5AB]/60 transition-all"
          >
            <SlidersHorizontal size={12} className="text-[#D4AF37]/60" />
            {SORT_OPTS.find(o => o.key === sort)?.label}
          </button>
          <AnimatePresence>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-2 z-20 w-40 bg-[#1B1212] border border-[#D4AF37]/20 rounded-2xl overflow-hidden shadow-xl"
                >
                  {SORT_OPTS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { onSort(opt.key); setSortOpen(false); }}
                      className={`w-full text-left px-5 py-3 text-xs font-bold transition-all ${
                        sort === opt.key
                          ? "bg-[#D4AF37]/10 text-[#D4AF37]"
                          : "text-[#F3E5AB]/50 hover:bg-white/3 hover:text-[#F3E5AB]/70"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STATS STRIP (top of marketplace)
// ---------------------------------------------------------------------------

function MarketplaceStats({ assets }: { assets: RWAAsset[] }) {
  const totalValue    = assets.reduce((sum, a) => sum + a.askPrice, 0n);
  const verifiedCount = assets.filter(a => a.isVerified).length;
  const avgScore      = assets.length > 0
    ? assets.reduce((sum, a) => sum + a.oracleScore, 0) / assets.length / 100
    : 0;

  const stats = [
    { label: "Total Listed Value",  value: `$${formatUsdc(totalValue)}`,        sub: "USDC",             icon: <TrendingUp size={18} className="text-[#D4AF37]" /> },
    { label: "Verified Assets",     value: `${verifiedCount}`,                  sub: `of ${assets.length} total`, icon: <ShieldCheck size={18} className="text-green-400" /> },
    { label: "Avg Oracle Score",    value: `${(avgScore * 100).toFixed(1)}`,     sub: "/ 100",            icon: <BadgeCheck size={18} className="text-[#D4AF37]" /> },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
      {stats.map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="bg-[#1B1212] border border-[#D4AF37]/8 rounded-[1.5rem] p-6 flex items-center gap-5"
        >
          <div className="p-3 bg-[#D4AF37]/6 rounded-2xl border border-[#D4AF37]/10">
            {s.icon}
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.35em] text-[#D4AF37]/50 mb-1">{s.label}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-serif text-white">{s.value}</span>
              <span className="text-xs text-[#F3E5AB]/40 font-medium">{s.sub}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EMPTY STATE
// ---------------------------------------------------------------------------

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="col-span-full flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-24 h-24 rounded-full bg-[#D4AF37]/5 border border-[#D4AF37]/10 flex items-center justify-center mb-6">
        <Landmark size={36} className="text-[#D4AF37]/30" />
      </div>
      <h3 className="font-serif text-2xl text-[#F3E5AB]/40 mb-3">
        {hasSearch ? "No Assets Found" : "Marketplace is Empty"}
      </h3>
      <p className="text-sm text-[#F3E5AB]/25 max-w-sm">
        {hasSearch
          ? "Try adjusting your search or filter criteria."
          : "No verified RWAs have been listed yet. Assets appear here once the AI Oracle validates them."}
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// TX TOAST
// ---------------------------------------------------------------------------

function TxToast({ message, opHash, onDismiss }: { message: string; opHash: string | null; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="fixed bottom-8 right-8 z-50 max-w-sm w-full bg-[#1B1212] border border-[#D4AF37]/25 rounded-[1.75rem] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center">
          <Zap size={16} className="text-[#D4AF37]" fill="currentColor" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#F3E5AB]">{message}</p>
          {opHash && (
            <p className="text-[10px] font-mono text-[#F3E5AB]/40 mt-1 truncate">{opHash}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 text-[9px] uppercase tracking-widest text-green-400 font-black">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Confirming on Base…
          </div>
        </div>
        <button onClick={onDismiss} className="flex-shrink-0 p-1 hover:bg-white/5 rounded-lg transition-colors">
          <X size={14} className="text-[#F3E5AB]/40" />
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function GlobalMarketplace() {
  const smartAccountAddress = useKulaStore(selectSmartAccountAddress);
  const activeGroupId       = useKulaStore(selectActiveGroupId);
  const activeGroupName     = useKulaStore(selectActiveGroupName);

  const { voteOnAsset, isSubmitting, lastOpHash, lastError } = useSmartAccount();

  const [filter,    setFilter]    = useState<FilterType>("all");
  const [sort,      setSort]      = useState<SortType>("newest");
  const [search,    setSearch]    = useState("");
  const [proposeTarget, setProposeTarget] = useState<RWAAsset | null>(null);
  const [votingId,  setVotingId]  = useState<number | null>(null);
  const [toast,     setToast]     = useState<{ msg: string; hash: string | null } | null>(null);

  // ── Fetch asset count ───────────────────────────────────────────────────
  const { data: blockNumber } = useBlockNumber({ watch: true, chainId: baseSepolia.id });

  const { data: assetCountData, isLoading: countLoading } = useReadContract({
    address:      REGISTRY_ADDRESS,
    abi:          REGISTRY_ABI,
    functionName: "assetCount",
    chainId:      baseSepolia.id,
    query: { refetchInterval: 15_000 },
  });

  const assetCount = Number(assetCountData ?? 0n);

  // ── Batch-fetch all assets ───────────────────────────────────────────────
  const assetCalls = useMemo(() =>
    Array.from({ length: assetCount }, (_, i) => ({
      address:      REGISTRY_ADDRESS,
      abi:          REGISTRY_ABI,
      functionName: "getAsset" as const,
      args:         [BigInt(i + 1)] as const,
      chainId:      baseSepolia.id,
    })),
    [assetCount]
  );

  const oracleCalls = useMemo(() =>
    Array.from({ length: assetCount }, (_, i) => ({
      address:      REGISTRY_ADDRESS,
      abi:          REGISTRY_ABI,
      functionName: "oracleScores" as const,
      args:         [BigInt(i + 1)] as const,
      chainId:      baseSepolia.id,
    })),
    [assetCount]
  );

  const { data: assetResults, isLoading: assetsLoading } = useReadContracts({
    contracts: assetCalls,
    query: { enabled: assetCount > 0, refetchInterval: 20_000 },
  });

  const { data: oracleResults } = useReadContracts({
    contracts: oracleCalls,
    query: { enabled: assetCount > 0, refetchInterval: 20_000 },
  });

  // ── Fetch proposal count ──────────────────────────────────────────────────
  const { data: proposalCountData } = useReadContract({
    address:      ROTARY_ADDRESS,
    abi:          ROTARY_ABI,
    functionName: "assetProposalCount",
    chainId:      baseSepolia.id,
    query: { refetchInterval: 12_000 },
  });

  const proposalCount = Number(proposalCountData ?? 0n);

  // ── Batch-fetch all proposals ────────────────────────────────────────────
  const proposalCalls = useMemo(() =>
    Array.from({ length: proposalCount }, (_, i) => ({
      address:      ROTARY_ADDRESS,
      abi:          ROTARY_ABI,
      functionName: "assetProposals" as const,
      args:         [BigInt(i + 1)] as const,
      chainId:      baseSepolia.id,
    })),
    [proposalCount]
  );

  const hasVotedCalls = useMemo(() =>
    smartAccountAddress
      ? Array.from({ length: proposalCount }, (_, i) => ({
          address:      ROTARY_ADDRESS,
          abi:          ROTARY_ABI,
          functionName: "hasVotedOnProposal" as const,
          args:         [BigInt(i + 1), smartAccountAddress as `0x${string}`] as const,
          chainId:      baseSepolia.id,
        }))
      : [],
    [proposalCount, smartAccountAddress]
  );

  const { data: proposalResults } = useReadContracts({
    contracts: proposalCalls,
    query: { enabled: proposalCount > 0, refetchInterval: 10_000 },
  });

  const { data: hasVotedResults } = useReadContracts({
    contracts: hasVotedCalls,
    query: { enabled: hasVotedCalls.length > 0, refetchInterval: 10_000 },
  });

  // ── Parse assets ──────────────────────────────────────────────────────────
  const assets: RWAAsset[] = useMemo(() => {
    if (!assetResults) return [];
    return assetResults
      .map((r, i) => {
        if (r.status !== "success" || !r.result) return null;
        const [id, poster, title, documentCid, askPrice, communityTrustScore, isVerified_, isMinted] = r.result as [bigint, string, string, string, bigint, bigint, boolean, boolean];
        const oracleRaw = oracleResults?.[i]?.status === "success" ? (oracleResults[i].result as bigint) : 0n;
        return {
          id:                  Number(id),
          poster,
          title,
          documentCid,
          askPrice,
          communityTrustScore: Number(communityTrustScore),
          isVerified:          isVerified_,
          isMinted,
          oracleScore:         Number(oracleRaw),
          assetType:           inferAssetType(title),
        } satisfies RWAAsset;
      })
      .filter(Boolean) as RWAAsset[];
  }, [assetResults, oracleResults]);

  // ── Parse proposals ───────────────────────────────────────────────────────
  const proposals: AssetProposal[] = useMemo(() => {
    if (!proposalResults) return [];
    return proposalResults
      .map((r, i) => {
        if (r.status !== "success" || !r.result) return null;
        const [groupId, registryAssetId, proposer, description, requestedAmount, votesFor, executed, exists] = r.result as [bigint, bigint, string, string, bigint, bigint, boolean, boolean];
        const hasVoted = hasVotedResults?.[i]?.status === "success" ? (hasVotedResults[i].result as boolean) : false;
        return {
          proposalId:      i + 1,
          groupId:         Number(groupId),
          registryAssetId: Number(registryAssetId),
          proposer,
          description,
          requestedAmount,
          votesFor:        Number(votesFor),
          executed,
          exists,
          hasVoted,
        } satisfies AssetProposal;
      })
      .filter(Boolean) as AssetProposal[];
  }, [proposalResults, hasVotedResults]);

  // ── Filter + sort + search ────────────────────────────────────────────────
  const filteredAssets = useMemo(() => {
    let arr = [...assets];

    if (filter !== "all") {
      arr = arr.filter(a => inferAssetType(a.title) === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.poster.toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case "price_asc":  arr.sort((a, b) => (a.askPrice < b.askPrice ? -1 : 1));  break;
      case "price_desc": arr.sort((a, b) => (a.askPrice > b.askPrice ? -1 : 1));  break;
      case "trust_desc": arr.sort((a, b) => b.oracleScore - a.oracleScore);        break;
      default:           arr.sort((a, b) => b.id - a.id);                          break;
    }

    return arr;
  }, [assets, filter, sort, search]);

  // ── Vote handler ──────────────────────────────────────────────────────────
  const handleVote = useCallback(async (proposalId: number, support: boolean) => {
    if (!smartAccountAddress) return;
    setVotingId(proposalId);
    try {
      const hash = await voteOnAsset(proposalId, support);
      if (hash) {
        setToast({ msg: `Vote ${support ? "For" : "Against"} submitted!`, hash });
      }
    } finally {
      setVotingId(null);
    }
  }, [smartAccountAddress, voteOnAsset]);

  const isLoading = countLoading || assetsLoading;

  return (
    <div className="space-y-8">
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-serif gold-text tracking-tight"
          >
            RWA Marketplace
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-[#F3E5AB]/50 tracking-[0.3em] text-xs uppercase mt-2 font-black"
          >
            AI-Oracle Verified · Base Sepolia · Public Registry
          </motion.p>
        </div>

        {/* Group context pill */}
        {activeGroupId && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 px-5 py-3 bg-[#D4AF37]/8 border border-[#D4AF37]/20 rounded-2xl"
          >
            <Zap size={14} className="text-[#D4AF37]" fill="currentColor" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]/60">Proposing for</p>
              <p className="text-sm font-bold text-[#D4AF37]">{activeGroupName ?? `Group #${activeGroupId}`}</p>
            </div>
          </motion.div>
        )}
        {!activeGroupId && smartAccountAddress && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl">
            <Info size={13} className="text-amber-400" />
            <p className="text-xs text-amber-400/80 font-bold">Join a group to propose acquisitions</p>
          </div>
        )}
      </div>

      {/* ── Stats strip ───────────────────────────────────────────────── */}
      {assets.length > 0 && <MarketplaceStats assets={assets} />}

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <FilterBar
        filter={filter}
        sort={sort}
        search={search}
        onFilter={setFilter}
        onSort={setSort}
        onSearch={setSearch}
        totalCount={filteredAssets.length}
      />

      {/* ── Error banner ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {lastError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-5 py-4 bg-red-500/8 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium"
          >
            <AlertTriangle size={16} className="flex-shrink-0" />
            {lastError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main grid ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          >
            <RefreshCw size={32} className="text-[#D4AF37]/40" />
          </motion.div>
          <p className="text-sm text-[#F3E5AB]/30 uppercase tracking-widest font-bold">
            Reading from KulaPublicRegistry…
          </p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.06 } },
            hidden:  {},
          }}
        >
          {filteredAssets.length > 0 ? (
            filteredAssets.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                proposals={proposals}
                groupId={activeGroupId}
                onPropose={a => setProposeTarget(a)}
                onVote={handleVote}
                votingId={votingId}
              />
            ))
          ) : (
            <EmptyState hasSearch={!!search.trim() || filter !== "all"} />
          )}
        </motion.div>
      )}

      {/* ── Purchase Execution Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {proposeTarget && (
          <PurchaseExecution
            asset={proposeTarget}
            groupId={activeGroupId!}
            onClose={() => setProposeTarget(null)}
            onSuccess={(hash) => {
              setProposeTarget(null);
              setToast({ msg: "Acquisition proposed on-chain!", hash });
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Tx toast ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <TxToast
            message={toast.msg}
            opHash={toast.hash}
            onDismiss={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
