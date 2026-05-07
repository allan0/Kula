"use client";

import React from "react";
import { User, Star, Award, Shield } from "lucide-react";

const members = [
  { 
    name: "Treasurer", 
    role: "Circle Admin", 
    score: 98, 
    address: "0x71C4...34a9",
    status: "online" 
  },
  { 
    name: "Member #04", 
    role: "Elite Contributor", 
    score: 94, 
    address: "0x82D7...11b2",
    status: "online" 
  },
  { 
    name: "Member #07", 
    role: "Verified", 
    score: 87, 
    address: "0xA3f9...9K2m",
    status: "offline" 
  },
];

export default function MemberDirectory() {
  return (
    <div className="glass-card rounded-[2.75rem] p-8 border border-[#D4AF37]/10 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-[#D4AF37] font-black text-xs uppercase tracking-[0.3em]">INNER CIRCLE</h3>
          <p className="text-sm text-[#F3E5AB]/70 mt-1">3 Active • 12 Total</p>
        </div>
        <Shield className="text-[#D4AF37]/60" size={22} />
      </div>

      <div className="space-y-6 flex-1">
        {members.map((member, i) => (
          <div 
            key={i} 
            className="flex items-center justify-between group hover:bg-white/5 -mx-2 px-2 py-2 rounded-2xl transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#D4AF37]/10 to-transparent flex items-center justify-center border border-[#D4AF37]/20">
                  <User size={22} className="text-[#D4AF37]" />
                </div>
                {member.status === "online" && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#0F0F0F]" />
                )}
              </div>

              <div>
                <p className="font-semibold text-[#F3E5AB]">{member.name}</p>
                <p className="text-[10px] text-[#F3E5AB]/50">{member.role}</p>
                <p className="font-mono text-[10px] text-[#D4AF37]/60 mt-0.5">
                  {member.address}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center text-[#D4AF37]">
                <Star size={14} fill="currentColor" />
                <span className="font-bold text-sm ml-1">{member.score}</span>
              </div>
              <Award size={16} className="text-[#D4AF37]/40" />
            </div>
          </div>
        ))}
      </div>

      <button className="mt-8 w-full py-4 border border-[#D4AF37]/30 hover:border-[#D4AF37] rounded-2xl text-xs font-black tracking-widest uppercase transition-all">
        INVITE NEW MEMBER
      </button>
    </div>
  );
}
