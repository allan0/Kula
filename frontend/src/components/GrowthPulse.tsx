"use client";
import { motion } from "framer-motion";
import { TrendingUp, ShieldCheck, Activity, Zap } from "lucide-react";

export default function GrowthPulse() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* YIELD CARD */}
      <div className="p-8 glass-card rounded-[2.5rem] border border-gold/20 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4 text-gold">
            <TrendingUp size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Live Yield Optimization</span>
          </div>
          <p className="text-4xl font-serif text-gold-light">8.42% <span className="text-sm text-green-500 font-sans tracking-tighter">APY</span></p>
          <p className="text-gold-light/40 text-[10px] mt-4 uppercase tracking-widest">Protocol: Aave V3 + Morpho Blue</p>
        </div>
        <Activity className="absolute -right-4 -bottom-4 text-gold/5 group-hover:text-gold/10 transition-colors" size={120} />
      </div>

      {/* INSURANCE CARD */}
      <div className="p-8 luxury-border rounded-[2.5rem] bg-gold/5 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4 text-gold">
            <ShieldCheck size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Insurance Reserve</span>
          </div>
          <p className="text-4xl font-serif text-gold-light">1,240.00 <span className="text-sm text-gold/60 font-sans">USDC</span></p>
        </div>
        <div className="mt-6 flex items-center gap-2">
           <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
           <p className="text-[9px] text-gold-light/40 uppercase font-bold tracking-widest">Self-Healing Protocol Active</p>
        </div>
      </div>
    </div>
  );
}
