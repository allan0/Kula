"use client";
import { motion } from "framer-motion";
import { UserCheck, UserX, ShieldAlert, Star, Phone } from "lucide-react";

const applicants = [
  { id: 1, name: "Alpha_User", type: "Telegram", score: 88, risk: "Low", delay: 0, referral: "Treasurer" },
  { id: 2, name: "+254***112", type: "USSD", score: 42, risk: "High", delay: 3, referral: "None" },
];

export default function AdmissionHall() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h3 className="text-2xl font-serif gold-text">Admission Hall</h3>
        <p className="text-gold-light/40 text-[10px] uppercase tracking-widest">Audit pending applicants to your circle</p>
      </div>

      {applicants.map((app) => (
        <motion.div 
          key={app.id}
          className="p-6 luxury-border rounded-3xl bg-gold/5 flex flex-col md:flex-row justify-between items-center gap-6"
        >
          <div className="flex items-center gap-4 flex-1">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${app.score > 70 ? 'border-gold bg-gold/10' : 'border-red-500/50 bg-red-500/10'}`}>
              <span className="text-xs font-black">{app.score}</span>
            </div>
            <div>
              <h4 className="text-gold-light font-bold">{app.name}</h4>
              <p className="text-[8px] text-gold-light/40 uppercase tracking-tighter">Referral: {app.referral}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 flex-1">
            <div>
              <p className="text-[8px] text-gold-light/30 uppercase font-bold">Threat Level</p>
              <p className={`text-xs font-black ${app.risk === 'Low' ? 'text-green-500' : 'text-red-500'}`}>{app.risk.toUpperCase()}</p>
            </div>
            <div>
              <p className="text-[8px] text-gold-light/30 uppercase font-bold">Past Delays</p>
              <p className="text-xs font-black text-gold-light">{app.delay} Events</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all">
              <UserX size={18} />
            </button>
            <button className="px-8 py-4 bg-gold text-earth-dark rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-lg">
              Admit Member
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
