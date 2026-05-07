"use client";
import React from "react";
import { User, Star } from "lucide-react";

const members = [
  { name: "Treasurer", role: "Admin", score: 98, address: "0x71C...34a9" },
  { name: "Member #04", role: "Elite", score: 92, address: "0x82D...11b2" },
];

export default function MemberDirectory() {
  return (
    <div className="glass-card rounded-[2.5rem] p-8 border border-[#D4AF37]/10">
      <h3 className="text-[#D4AF37] font-black text-[10px] uppercase tracking-[0.3em] mb-6">Circle Members</h3>
      <div className="space-y-6">
        {members.map((member, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37]">
                <User size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#F3E5AB]">{member.name}</p>
                <p className="text-[8px] text-[#F3E5AB]/30 uppercase">{member.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[#D4AF37]">
              <Star size={8} fill="currentColor" />
              <span className="text-[10px] font-black">{member.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
