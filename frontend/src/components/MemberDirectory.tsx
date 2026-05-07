"use client";
import { motion } from "framer-motion";
import { User, ShieldCheck, Star } from "lucide-react";

const members = [
  { name: "Treasurer", role: "Admin", score: 98, status: "Online", address: "0x71C...34a9" },
  { name: "Member #04", role: "Elite", score: 92, status: "Offline", address: "0x82D...11b2" },
  { name: "Member #07", role: "Contributor", score: 85, status: "Online", address: "0x33A...99c1" },
  { name: "Member #12", role: "New", score: 50, status: "Online", address: "0xFfA...08fe" },
];

export default function MemberDirectory() {
  return (
    <div className="glass-card rounded-[2.5rem] p-8 border border-gold/10">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-gold font-black text-[10px] uppercase tracking-[0.3em]">Circle Members</h3>
        <span className="text-[10px] text-gold-light/40 uppercase">{members.length} Active</span>
      </div>

      <div className="space-y-6">
        {members.map((member, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                  <User size={18} />
                </div>
                {member.status === "Online" && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-earth-dark rounded-full" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-gold-light group-hover:text-gold transition-colors">{member.name}</p>
                <p className="text-[8px] text-gold-light/30 uppercase tracking-tighter">{member.role} • {member.address}</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end text-gold">
                <Star size={8} fill="currentColor" />
                <span className="text-[10px] font-black">{member.score}</span>
              </div>
              <p className="text-[7px] text-gold-light/20 uppercase font-bold">Trust</p>
            </div>
          </motion.div>
        ))}
      </div>

      <button className="w-full mt-8 py-4 border border-gold/10 rounded-2xl text-[9px] font-black text-gold/40 uppercase tracking-widest hover:bg-gold/5 hover:text-gold transition-all">
        View Governance History
      </button>
    </div>
  );
}
