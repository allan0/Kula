"use client";

import { motion } from "framer-motion";
import { TrendingUp, ShieldCheck, Activity, Zap, ArrowUpRight } from "lucide-react";

export default function GrowthPulse() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
      {/* Live Yield Card */}
      <div className="glass-card rounded-[2.75rem] p-10 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-green-500/10 rounded-2xl">
              <TrendingUp size={26} className="text-green-500" />
            </div>
            <div>
              <p className="uppercase text-xs tracking-[0.4em] font-black text-green-500">YIELD ENGINE ACTIVE</p>
              <p className="text-sm text-[#F3E5AB]/70">Aave V3 + Morpho</p>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-6xl font-serif tracking-tighter text-white">8.42</span>
            <span className="text-3xl text-green-500 font-light">%</span>
            <span className="text-sm text-green-500/80 self-end mb-3">APY</span>
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs uppercase tracking-widest text-green-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            COMPOUNDING IN REAL TIME
          </div>
        </div>

        <Activity 
          className="absolute -bottom-6 -right-6 text-green-500/10 group-hover:text-green-500/20 transition-colors" 
          size={180} 
        />
      </div>

      {/* Insurance Reserve */}
      <div className="luxury-border rounded-[2.75rem] p-10 bg-gradient-to-br from-[#D4AF37]/5 to-transparent flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck size={26} className="text-[#D4AF37]" />
            <p className="uppercase text-xs tracking-[0.4em] font-black text-[#D4AF37]">INSURANCE RESERVE</p>
          </div>
          
          <p className="text-6xl font-serif tracking-tighter text-white">1,240.00</p>
          <p className="text-[#D4AF37] text-xl -mt-2">USDC</p>
        </div>

        <div className="mt-10 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="px-4 py-2 bg-green-500/10 text-green-500 text-xs font-bold rounded-2xl border border-green-500/20">
              SELF-HEALING
            </div>
          </div>
          <div className="text-xs text-[#F3E5AB]/60 flex items-center gap-1">
            +42 USDC <ArrowUpRight size={14} /> this week
          </div>
        </div>
      </div>
    </div>
  );
}
