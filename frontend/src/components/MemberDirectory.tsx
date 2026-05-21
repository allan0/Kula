// FILE: frontend/src/components/MemberDirectory.tsx
// PURPOSE: Web/TMA version of the Member Directory.
// Uses Framer Motion, lucide-react, and standard HTML/Tailwind.

"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Globe, Send, Phone, User, X } from "lucide-react";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type PlatformType = "ALL" | "USSD" | "WEB" | "TELEGRAM";

export interface Member {
  id: string;
  displayName: string;
  shortAddress: string;
  fullAddress: string;
  reputationScore: number;
  reputationTier: "Elite" | "Trusted" | "Active" | "New" | "Probation";
  platform: "USSD" | "WEB" | "TELEGRAM";
  avatarUri?: string;
  isCurrentRecipient?: boolean;
}

// ---------------------------------------------------------------------------
// MOCK DATA (Replace with wagmi/backend fetches later)
// ---------------------------------------------------------------------------

const MOCK_MEMBERS: Member[] = [
  {
    id: "1",
    displayName: "Wanjiku M.",
    shortAddress: "0xA1B2...3C4D",
    fullAddress: "0xA1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2",
    reputationScore: 94,
    reputationTier: "Elite",
    platform: "TELEGRAM",
    isCurrentRecipient: true,
  },
  {
    id: "2",
    displayName: "Kamau T.",
    shortAddress: "0xD5E6...7F8A",
    fullAddress: "0xD5E67F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4",
    reputationScore: 81,
    reputationTier: "Trusted",
    platform: "WEB",
  },
  {
    id: "3",
    displayName: "+254712345678",
    shortAddress: "0x9B0C...1D2E",
    fullAddress: "0x9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8",
    reputationScore: 63,
    reputationTier: "Active",
    platform: "USSD",
  },
  {
    id: "4",
    displayName: "Achieng O.",
    shortAddress: "0x3F4A...5B6C",
    fullAddress: "0x3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2",
    reputationScore: 50,
    reputationTier: "New",
    platform: "WEB",
  },
];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function getPlatformIcon(platform: Member["platform"]) {
  switch (platform) {
    case "TELEGRAM": return <Send size={14} className="text-[#229ED9]" />;
    case "USSD":     return <Phone size={14} className="text-green-500" />;
    case "WEB":      return <Globe size={14} className="text-[#D4AF37]" />;
  }
}

function getTierColor(tier: Member["reputationTier"]): string {
  switch (tier) {
    case "Elite":     return "text-yellow-400";
    case "Trusted":   return "text-green-400";
    case "Active":    return "text-blue-400";
    case "New":       return "text-zinc-400";
    case "Probation": return "text-red-400";
    default:          return "text-zinc-400";
  }
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-red-500";
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function MemberDirectory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<PlatformType>("ALL");

  const filtered = useMemo(() => {
    return MOCK_MEMBERS.filter((m) => {
      const matchesSearch =
        searchQuery === "" ||
        m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.shortAddress.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform = filter === "ALL" || m.platform === filter;
      return matchesSearch && matchesPlatform;
    });
  }, [searchQuery, filter]);

  return (
    <div className="flex flex-col h-full bg-[#1B1212] rounded-[2.5rem] overflow-hidden border border-[#D4AF37]/15 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[#D4AF37] text-[9px] uppercase tracking-[0.35em] font-black">
              Sovereign Circle
            </p>
            <h3 className="text-white text-xl font-semibold mt-1">Members</h3>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 text-xs font-bold">{MOCK_MEMBERS.length} active</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative flex items-center bg-[#0F0F0F] border border-[#D4AF37]/20 rounded-2xl px-4 py-3 mb-4 focus-within:border-[#D4AF37]/50 transition-colors">
          <Search size={16} className="text-[#D4AF37]/40" />
          <input
            type="text"
            className="flex-1 bg-transparent text-white text-sm ml-3 outline-none placeholder:text-[#F3E5AB]/30"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-[#D4AF37]/40 hover:text-[#D4AF37]">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {(["ALL", "TELEGRAM", "WEB", "USSD"] as PlatformType[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all whitespace-nowrap ${
                filter === opt
                  ? "bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]"
                  : "border border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto custom-scroll px-2">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <User size={32} className="text-zinc-600 mb-3" />
              <p className="text-zinc-500 text-sm">No members found</p>
            </motion.div>
          ) : (
            filtered.map((item, index) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                key={item.id}
                className="flex items-center px-4 py-4 border-b border-[#D4AF37]/10 hover:bg-white/[0.02] transition-colors group"
              >
                {/* Avatar */}
                <div className="relative w-11 h-11 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center mr-4 shrink-0 border border-[#D4AF37]/20">
                  {item.avatarUri ? (
                    <img src={item.avatarUri} alt={item.displayName} className="w-full h-full rounded-[14px] object-cover" />
                  ) : (
                    <span className="text-[#D4AF37] font-bold text-lg">
                      {item.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  {item.isCurrentRecipient && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-black text-[10px] font-black">★</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold text-sm truncate">
                      {item.displayName}
                    </span>
                    {item.isCurrentRecipient && (
                      <span className="px-2 py-0.5 bg-[#D4AF37]/15 border border-[#D4AF37]/30 rounded-full text-[#D4AF37] text-[9px] font-black tracking-widest uppercase">
                        Next Payout
                      </span>
                    )}
                  </div>

                  <a
                    href={`https://sepolia.basescan.org/address/${item.fullAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-[#D4AF37] transition-colors font-mono text-xs"
                  >
                    {item.shortAddress}
                  </a>

                  {/* Reputation Bar */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getScoreBarColor(item.reputationScore)}`}
                        style={{ width: `${item.reputationScore}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-bold w-6 text-right ${getTierColor(item.reputationTier)}`}>
                      {item.reputationScore}
                    </span>
                  </div>
                </div>

                {/* Right side status */}
                <div className="flex flex-col items-end gap-1.5 ml-4">
                  {getPlatformIcon(item.platform)}
                  <span className={`text-[9px] font-black uppercase tracking-widest ${getTierColor(item.reputationTier)}`}>
                    {item.reputationTier}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="px-6 py-4 border-t border-[#D4AF37]/10 flex items-center justify-between bg-black/20">
        <span className="text-zinc-500 text-xs font-medium">
          {filtered.length} of {MOCK_MEMBERS.length} members
        </span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/60" />
          <span className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest font-bold">
            Live Sync
          </span>
        </div>
      </div>
    </div>
  );
}
