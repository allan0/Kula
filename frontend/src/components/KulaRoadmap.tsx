"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, Star, Zap, Landmark, Clock } from "lucide-react";

export default function KulaRoadmap() {
  const steps = [
    { 
      status: "Complete", 
      title: "Genesis & L2 Foundation", 
      desc: "Core ROSCA smart contracts deployed on Base Sepolia with full governance logic.",
      icon: <CheckCircle2 size={22} />,
      progress: 100,
      date: "Q4 2025"
    },
    { 
      status: "Live", 
      title: "Universal Access Layer", 
      desc: "USSD + Privy Social Login (Telegram, Google, Email) for seamless African adoption.",
      icon: <Zap size={22} />,
      progress: 100,
      date: "Q1 2026"
    },
    { 
      status: "Active", 
      title: "Asset Oracle & Registry", 
      desc: "Public RWA listing with community trust voting system for land and vehicles.",
      icon: <Landmark size={22} />,
      progress: 92,
      date: "Current"
    },
    { 
      status: "In Progress", 
      title: "Trust Equity (RWA) Minting", 
      desc: "Tokenizing verified deeds into KULA-RWA NFTs with fractional ownership.",
      icon: <Star size={22} />,
      progress: 65,
      date: "Q2 2026"
    },
    { 
      status: "Planned", 
      title: "Automated Yield Engine", 
      desc: "Idle capital deployed into Aave & Morpho for compounding group wealth.",
      icon: <Clock size={22} />,
      progress: 15,
      date: "Q3 2026"
    },
  ];

  return (
    <div className="glass-card rounded-[3rem] p-10 md:p-14">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h3 className="text-3xl font-serif gold-text">Kula Protocol Roadmap</h3>
          <p className="text-[#F3E5AB]/60 text-sm mt-2">Building the future of collective wealth</p>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-widest text-[#D4AF37]">Phase 03</span>
        </div>
      </div>

      <div className="space-y-10 relative pl-4 before:absolute before:left-[15px] before:top-8 before:bottom-8 before:w-[2px] before:bg-gradient-to-b before:from-[#D4AF37]/30 before:to-transparent">
        {steps.map((step, i) => (
          <div key={i} className="relative flex gap-8 group">
            {/* Timeline Node */}
            <div className={`relative z-10 w-9 h-9 rounded-2xl flex items-center justify-center border-2 transition-all flex-shrink-0
              ${step.status === 'Complete' || step.status === 'Live' 
                ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-[0_0_25px_rgba(212,175,55,0.5)]' 
                : step.status === 'Active' 
                ? 'border-[#D4AF37] bg-black' 
                : 'border-[#D4AF37]/30 bg-black/60'}`}>
              {step.icon}
            </div>

            <div className="flex-1 pb-8">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-[#D4AF37]">
                    PHASE 0{i + 1} • {step.status.toUpperCase()}
                  </span>
                  <h4 className="text-xl font-medium mt-2 text-white">{step.title}</h4>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#D4AF37]/60 font-mono">{step.date}</span>
                  <div className="text-sm font-mono text-[#D4AF37] mt-1">{step.progress}%</div>
                </div>
              </div>

              <p className="text-[#F3E5AB]/70 mt-4 leading-relaxed pr-8">
                {step.desc}
              </p>

              {/* Progress Bar */}
              <div className="mt-6 w-full h-1 bg-[#D4AF37]/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  whileInView={{ width: `${step.progress}%` }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
