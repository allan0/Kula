"use client";

import { motion } from "framer-motion";
import { Eye, ShieldCheck, CheckCircle2, ExternalLink, AlertTriangle, Clock } from "lucide-react";

const auditLog = [
  { 
    id: 1, 
    type: "Property", 
    title: "5-Acre Kitengela Plot", 
    cid: "QmXoyp...789", 
    status: "Approved", 
    votes: 20, 
    total: 20,
    date: "2d ago"
  },
  { 
    id: 2, 
    type: "Vehicle", 
    title: "Toyota Hilux 2024", 
    cid: "QmZ3aB...456", 
    status: "Voting", 
    votes: 14, 
    total: 20,
    date: "5d ago"
  },
  { 
    id: 3, 
    type: "Bill", 
    title: "Medical Support - Member #08", 
    cid: "QmWq2r...123", 
    status: "Executed", 
    votes: 18, 
    total: 20,
    date: "12d ago"
  },
];

export default function TreasurerView() {
  const ipfsGateway = "https://gateway.pinata.cloud/ipfs/";

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-serif gold-text">Treasurer’s Ledger</h2>
          <p className="text-[#F3E5AB]/60 text-sm mt-2">Real-time audit & execution portal</p>
        </div>
        
        <div className="glass-card px-8 py-5 rounded-3xl border border-[#D4AF37]/20 text-right">
          <p className="text-xs uppercase tracking-widest text-[#D4AF37]/70">GROUP LIQUIDITY</p>
          <p className="text-4xl font-serif tracking-tighter text-white">$142,500.00</p>
        </div>
      </div>

      <div className="space-y-6">
        {auditLog.map((item, index) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card rounded-3xl p-8 flex flex-col md:flex-row gap-8 md:items-center hover:border-[#D4AF37]/40 transition-all group"
          >
            <div className="flex-1 flex items-start gap-6">
              <div className={`p-5 rounded-2xl flex-shrink-0 ${
                item.status === 'Executed' ? 'bg-green-500/10 text-green-500' : 
                item.status === 'Approved' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 
                'bg-amber-500/10 text-amber-500'
              }`}>
                {item.status === 'Executed' ? <CheckCircle2 size={28} /> : 
                 item.status === 'Approved' ? <ShieldCheck size={28} /> : 
                 <AlertTriangle size={28} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-black uppercase tracking-widest px-4 py-1 bg-white/5 rounded-full">
                    {item.type}
                  </span>
                  <span className="text-xs text-[#D4AF37]/60 font-mono">{item.date}</span>
                </div>
                
                <h4 className="text-xl font-medium text-white mb-1 line-clamp-1">{item.title}</h4>
                
                <div className="flex items-center gap-4 text-xs text-[#F3E5AB]/60">
                  <a 
                    href={`${ipfsGateway}${item.cid}`} 
                    target="_blank"
                    className="flex items-center gap-1.5 hover:text-white transition-colors"
                  >
                    <Eye size={14} /> View Document
                  </a>
                </div>
              </div>
            </div>

            {/* Voting Progress */}
            <div className="md:w-72 flex-shrink-0">
              <div className="flex justify-between text-xs mb-3">
                <span className="text-[#F3E5AB]/70">Community Vote</span>
                <span className="font-mono">{item.votes}/{item.total}</span>
              </div>
              
              <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                <div 
                  className={`h-full rounded-full transition-all ${
                    item.status === 'Executed' || item.status === 'Approved' 
                      ? 'bg-green-500' 
                      : 'bg-[#D4AF37]'
                  }`}
                  style={{ width: `${(item.votes / item.total) * 100}%` }}
                />
              </div>

              <div className="flex gap-3">
                {item.status === 'Voting' && (
                  <button className="flex-1 py-3.5 text-xs font-black tracking-widest border border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black rounded-2xl transition-all">
                    REVIEW
                  </button>
                )}
                
                {item.status === 'Approved' && (
                  <button className="flex-1 py-3.5 text-xs font-black tracking-widest bg-[#D4AF37] text-black rounded-2xl">
                    EXECUTE
                  </button>
                )}
                
                {item.status === 'Executed' && (
                  <div className="flex-1 py-3.5 text-center text-xs font-black tracking-widest text-green-500 border border-green-500/30 rounded-2xl">
                    ✓ EXECUTED
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="text-center pt-8">
        <p className="text-xs text-[#D4AF37]/50 tracking-widest">All actions are recorded on Base Sepolia • Immutable</p>
      </div>
    </div>
  );
}
