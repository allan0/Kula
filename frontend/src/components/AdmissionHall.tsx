"use client";

import { motion } from "framer-motion";
import { UserCheck, UserX, ShieldAlert, Star, Phone, Award } from "lucide-react";

const applicants = [
  { 
    id: 1, 
    name: "Alpha_User", 
    type: "Telegram", 
    score: 88, 
    risk: "Low", 
    delay: 0, 
    referral: "Treasurer",
    alignment: "92%"
  },
  { 
    id: 2, 
    name: "+254 7•• •••112", 
    type: "USSD", 
    score: 42, 
    risk: "High", 
    delay: 3, 
    referral: "None",
    alignment: "31%"
  },
  { 
    id: 3, 
    name: "Nairobi_Elite", 
    type: "Privy", 
    score: 76, 
    risk: "Medium", 
    delay: 1, 
    referral: "Member #04",
    alignment: "87%"
  },
];

export default function AdmissionHall() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-3xl font-serif gold-text">Admission Hall</h3>
          <p className="text-[#F3E5AB]/60 text-sm">Review and vote on new applicants</p>
        </div>
        <div className="text-xs uppercase tracking-widest bg-[#D4AF37]/10 text-[#D4AF37] px-5 py-2 rounded-2xl font-black">
          3 PENDING
        </div>
      </div>

      {applicants.map((app, index) => (
        <motion.div 
          key={app.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="glass-card rounded-3xl p-8 flex flex-col md:flex-row gap-8 items-center hover:border-[#D4AF37]/40 transition-all group"
        >
          <div className="flex items-center gap-6 flex-1">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 text-2xl font-black
              ${app.score >= 75 ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-red-500/50 bg-red-500/10 text-red-500'}`}>
              {app.score}
            </div>

            <div>
              <h4 className="text-xl font-medium">{app.name}</h4>
              <div className="flex items-center gap-3 text-xs text-[#F3E5AB]/60 mt-1">
                <span className="font-mono">{app.type}</span>
                <span>•</span>
                <span>Referred by {app.referral}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8 flex-1">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#F3E5AB]/50">Trust Score</p>
              <p className="text-2xl font-serif text-white">{app.score}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-[#F3E5AB]/50">Risk Level</p>
              <p className={`text-lg font-bold ${app.risk === 'Low' ? 'text-green-500' : app.risk === 'Medium' ? 'text-amber-500' : 'text-red-500'}`}>
                {app.risk}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-[#F3E5AB]/50">Goal Alignment</p>
              <p className="text-lg font-medium text-[#D4AF37]">{app.alignment}</p>
            </div>
          </div>

          <div className="flex gap-4 md:w-auto w-full md:justify-end">
            <button className="flex-1 md:flex-none px-8 py-5 border border-red-500/30 hover:bg-red-500/10 text-red-500 rounded-2xl font-black text-sm tracking-widest transition-all flex items-center justify-center gap-2">
              <UserX size={18} /> REJECT
            </button>
            
            <button className="flex-1 md:flex-none px-10 py-5 bg-[#D4AF37] text-black rounded-2xl font-black text-sm tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
              <UserCheck size={18} /> ADMIT MEMBER
            </button>
          </div>
        </motion.div>
      ))}

      <div className="text-center text-xs text-[#D4AF37]/50 tracking-widest pt-6">
        All admissions require 70%+ group approval • Reputation system active
      </div>
    </div>
  );
}
