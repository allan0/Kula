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
  Users,
  Award
} from "lucide-react";

export default function IdentityHub() {
  const { user, linkGoogle, linkLinkedin, linkTelegram } = usePrivy();

  const calculateTrustScore = () => {
    let score = 35; // Base score
    if (user?.google) score += 22;
    if (user?.linkedin) score += 28;
    if (user?.telegram) score += 25;
    return Math.min(score, 100);
  };

  const trustScore = calculateTrustScore();

  const socialAccounts = [
    { 
      name: "Google", 
      icon: <Mail size={22} />, 
      action: linkGoogle, 
      linked: !!user?.google,
      desc: "Email & Identity Verification",
      color: "text-blue-400"
    },
    { 
      name: "LinkedIn", 
      icon: <Linkedin size={22} />, 
      action: linkLinkedin, 
      linked: !!user?.linkedin,
      desc: "Professional Background",
      color: "text-[#0A66C2]"
    },
    { 
      name: "Telegram", 
      icon: <Send size={22} />, 
      action: linkTelegram, 
      linked: !!user?.telegram,
      desc: "Social & Group Alignment",
      color: "text-[#229ED9]"
    },
  ];

  const analyzeTelegram = () => {
    if (!user?.telegram) {
      alert("Please connect Telegram first.");
      return;
    }
    alert(`Analyzing @${user.telegram.username}...\n\nGoal Alignment: HIGH\nCommunity Reputation: Strong\nRecommended Circles: Nairobi Real Estate, Base Builders`);
  };

  return (
    <div className="space-y-10">
      {/* Trust Score Header */}
      <div className="luxury-border rounded-[2.75rem] p-10 bg-gradient-to-br from-[#1B1212] to-black/60">
        <div className="flex justify-between items-start">
          <div>
            <p className="uppercase text-xs tracking-[0.4em] text-[#D4AF37] font-black">VAULT INTEGRITY</p>
            <div className="flex items-baseline gap-4 mt-3">
              <span className="text-7xl font-serif text-white">{trustScore}</span>
              <span className="text-3xl text-[#D4AF37]">%</span>
            </div>
          </div>
          <ShieldCheck size={72} className="text-[#D4AF37] opacity-30" />
        </div>

        <div className="mt-8 h-2.5 bg-[#D4AF37]/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${trustScore}%` }}
            className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] rounded-full"
          />
        </div>
      </div>

      {/* Social Verification Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {socialAccounts.map((account, index) => (
          <motion.button
            key={index}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => !account.linked && account.action?.()}
            className={`p-8 rounded-3xl border transition-all flex flex-col items-center text-center ${
              account.linked 
                ? 'border-[#D4AF37] bg-[#D4AF37]/5' 
                : 'border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
            }`}
          >
            <div className={`mb-6 text-4xl ${account.linked ? 'text-[#D4AF37]' : 'text-[#D4AF37]/30'} ${account.color}`}>
              {account.icon}
            </div>
            
            <p className="font-bold text-lg mb-1">{account.name}</p>
            <p className="text-xs text-[#F3E5AB]/60 mb-6">{account.desc}</p>

            {account.linked ? (
              <div className="flex items-center gap-2 text-green-500 text-sm font-bold">
                <CheckCircle2 size={18} /> VERIFIED
              </div>
            ) : (
              <span className="text-xs uppercase tracking-widest border border-[#D4AF37]/30 px-6 py-2 rounded-full">Connect</span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Telegram Intelligence */}
      {user?.telegram && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-[2.75rem] p-10 border-l-4 border-[#229ED9]"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-[#229ED9]/10 rounded-2xl">
              <Send size={28} className="text-[#229ED9]" />
            </div>
            <div>
              <p className="text-[#229ED9] uppercase text-xs font-black tracking-widest">TELEGRAM SYNC ACTIVE</p>
              <p className="text-xl font-medium">@{user.telegram.username}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 bg-black/40 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Users className="text-[#D4AF37]" />
                <span className="uppercase text-xs tracking-widest">Circle Alignment</span>
              </div>
              <p className="text-4xl font-serif text-green-400">94%</p>
            </div>
            
            <div className="p-6 bg-black/40 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Award className="text-[#D4AF37]" />
                <span className="uppercase text-xs tracking-widest">Trust Delta</span>
              </div>
              <p className="text-4xl font-serif">+28</p>
            </div>
          </div>

          <button 
            onClick={analyzeTelegram}
            className="mt-8 w-full py-5 border border-[#229ED9]/30 hover:bg-[#229ED9]/10 rounded-2xl text-sm font-black tracking-widest"
          >
            RUN DEEP ANALYSIS
          </button>
        </motion.div>
      )}

      {/* Final CTA */}
      <div className="pt-6">
        <button className="w-full py-6 bg-gradient-to-r from-[#D4AF37] to-[#B8972E] text-black rounded-3xl font-black text-sm tracking-[0.08em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all">
          <UserPlus size={20} />
          INVITE NEW MEMBERS
        </button>
        <p className="text-center text-[10px] text-[#D4AF37]/40 mt-6 tracking-widest">
          Higher trust unlocks larger contributions and priority asset access
        </p>
      </div>
    </div>
  );
}
