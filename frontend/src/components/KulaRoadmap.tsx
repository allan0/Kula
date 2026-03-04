"use client";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Star, Zap, Landmark } from "lucide-react";

export default function KulaRoadmap() {
  const steps = [
    { 
      status: "Complete", 
      title: "Genesis & L2 Foundation", 
      desc: "Deployment of Core ROSCA logic on Base L2 with Luxury UI interface.",
      icon: <CheckCircle2 size={16} />,
      progress: 100
    },
    { 
      status: "Live", 
      title: "Universal Access Bridge", 
      desc: "USSD offline connectivity and Privy Social Identity (Gmail/LinkedIn/Telegram) integration.",
      icon: <Zap size={16} />,
      progress: 100
    },
    { 
      status: "Active", 
      title: "The Asset Oracle", 
      desc: "Public Asset Registry & Community Trust Voting for Property and Vehicles.",
      icon: <Landmark size={16} />,
      progress: 85
    },
    { 
      status: "In Progress", 
      title: "Trust Equity (RWA) Minting", 
      desc: "Tokenizing verified title deeds into ERC-721 NFTs with atomic wealth transfer logic.",
      icon: <Star size={16} />,
      progress: 40
    },
    { 
      status: "Planned", 
      title: "Global Liquidity Yield", 
      desc: "Automated staking in Aave/Compound to grow circle wealth during voting phases.",
      icon: <Circle size={16} />,
      progress: 0
    },
  ];

  return (
    <div className="space-y-10 py-6">
      {steps.map((step, i) => (
        <div key={i} className="relative flex gap-8 group">
          {/* Vertical Line */}
          {i !== steps.length - 1 && (
            <div className="absolute left-[15px] top-8 w-[1px] h-full bg-gold/10 group-hover:bg-gold/30 transition-colors" />
          )}

          {/* Icon Node */}
          <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-500 ${
            step.status === 'Complete' || step.status === 'Live' 
            ? 'bg-gold border-gold text-earth-dark shadow-[0_0_20px_rgba(212,175,55,0.4)]' 
            : step.status === 'Active'
            ? 'bg-earth border-gold text-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]'
            : 'bg-earth-dark border-gold/20 text-gold/20'
          }`}>
            {step.icon}
          </div>

          {/* Content */}
          <div className="flex-1 pb-2">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                  step.status === 'Complete' ? 'text-gold/50' : 'text-gold'
                }`}>
                  Phase 0{i + 1} • {step.status}
                </span>
                <h4 className="text-xl font-serif text-gold-light mt-1">{step.title}</h4>
              </div>
              <span className="text-[10px] font-mono text-gold/30">{step.progress}%</span>
            </div>
            
            <p className="text-sm text-gold-light/40 leading-relaxed mb-4">
              {step.desc}
            </p>

            {/* Micro Progress Bar */}
            <div className="w-full h-[2px] bg-gold/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                whileInView={{ width: `${step.progress}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-gold/40"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
