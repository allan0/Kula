"use client";
import { usePrivy } from "@privy-io/react-auth";
import { motion } from "framer-motion";
import { 
  Mail, 
  Linkedin, 
  Send, 
  ShieldCheck, 
  UserPlus, 
  CheckCircle2, 
  BarChart3,
  Users
} from "lucide-react";

export default function IdentityHub() {
  const { user, linkTelegram, linkLinkedin, linkGoogle } = usePrivy();

  // Logic to calculate Trust Score based on linked accounts
  const calculateTrustScore = () => {
    let score = 30; // Base score
    if (user?.google) score += 20;
    if (user?.linkedin) score += 25;
    if (user?.telegram) score += 25;
    return score;
  };

  const socialAccounts = [
    { 
      name: "Google", 
      icon: <Mail size={18} />, 
      action: linkGoogle, 
      linked: !!user?.google,
      desc: "Gmail Verification" 
    },
    { 
      name: "LinkedIn", 
      icon: <Linkedin size={18} />, 
      action: linkLinkedin, 
      linked: !!user?.linkedin,
      desc: "Professional Audit"
    },
    { 
      name: "Telegram", 
      icon: <Send size={18} />, 
      action: linkTelegram, 
      linked: !!user?.telegram,
      desc: "Social Sync"
    },
  ];

  const analyzeTelegram = () => {
    if (!user?.telegram) return alert("Please connect Telegram first.");
    alert(`Analyzing @${user.telegram.username}... Found 92% goal alignment with "Real Estate" and "Asset Accumulation" circles.`);
  };

  return (
    <div className="space-y-8 py-2">
      {/* 1. TRUST SCORE HEADER */}
      <div className="relative p-8 luxury-border rounded-[2.5rem] bg-gold/5 overflow-hidden group">
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <p className="text-[10px] text-gold uppercase font-black tracking-[0.3em] mb-1">Vault Trust Rating</p>
            <h4 className="text-5xl font-serif gold-text">{calculateTrustScore()}%</h4>
          </div>
          <div className="text-right">
            <ShieldCheck size={48} className="text-gold opacity-40 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        {/* Animated Progress Bar */}
        <div className="mt-6 w-full h-1 bg-gold/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${calculateTrustScore()}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gold shadow-[0_0_15px_#D4AF37]"
          />
        </div>
      </div>

      {/* 2. SOCIAL VERIFICATION GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {socialAccounts.map((s) => (
          <button
            key={s.name}
            onClick={() => !s.linked && s.action()}
            className={`p-6 rounded-[2rem] flex flex-col items-center text-center gap-3 transition-all border ${
              s.linked 
                ? "border-gold bg-gold/5 shadow-[0_0_20px_rgba(212,175,55,0.1)]" 
                : "border-gold/10 bg-earth-dark/40 hover:border-gold/30"
            }`}
          >
            <div className={s.linked ? "text-gold" : "text-gold/20"}>{s.icon}</div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${s.linked ? "text-gold" : "text-gold-light/40"}`}>
                {s.linked ? "Verified" : s.name}
              </p>
              <p className="text-[8px] text-gold-light/20 uppercase mt-1">{s.desc}</p>
            </div>
            {s.linked && <CheckCircle2 size={12} className="text-gold mt-1" />}
          </button>
        ))}
      </div>

      {/* 3. TELEGRAM INTELLIGENCE PANEL */}
      {user?.telegram && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 glass-card rounded-[2.5rem] border-l-4 border-[#229ED9]"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#229ED9]/10 rounded-2xl text-[#229ED9]">
                <Send size={20} />
              </div>
              <div>
                <p className="text-[#229ED9] text-[10px] font-black uppercase tracking-widest">Telegram Identity Sync</p>
                <h5 className="text-lg font-serif text-gold-light">@{user.telegram.username || "Anonymous"}</h5>
              </div>
            </div>
            <div className="px-3 py-1 bg-gold/10 rounded-full border border-gold/20 text-[8px] text-gold font-bold uppercase">Active</div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-earth-dark/60 rounded-2xl border border-gold/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users size={16} className="text-gold-light/40" />
                <span className="text-xs text-gold-light/60">Connected Channel Activity</span>
              </div>
              <button onClick={analyzeTelegram} className="text-[10px] text-gold font-bold border-b border-gold/30 hover:text-gold-light transition-colors">
                VIEW ANALYTICS
              </button>
            </div>

            <div className="p-4 bg-earth-dark/60 rounded-2xl border border-gold/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 size={16} className="text-gold-light/40" />
                <span className="text-xs text-gold-light/60">ROSCA Goal Alignment</span>
              </div>
              <span className="text-[10px] font-black text-gold">HIGH</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* 4. CALL TO ACTION */}
      <div className="pt-4">
        <button className="w-full py-5 bg-gold text-earth-dark rounded-[1.5rem] font-black text-xs tracking-[0.3em] uppercase flex items-center justify-center gap-3 shadow-[0_15px_30px_rgba(212,175,55,0.2)] hover:scale-[1.02] active:scale-95 transition-all">
          <UserPlus size={18} /> Invite Inner Circle
        </button>
        <p className="text-center text-[9px] text-gold-light/20 uppercase tracking-widest mt-6">
          Verified KULA members can unlock higher credit limits & secondary asset markets.
        </p>
      </div>
    </div>
  );
}
