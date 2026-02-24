"use client";
import { motion } from "framer-motion";
import { Eye, ShieldAlert, CheckCircle2, ExternalLink, TrendingUp } from "lucide-react";

// Mock data for the MVP - in production, this comes from your Smart Contract
const auditLog = [
  { id: 1, type: "Property", title: "5-Acre Kitengela Plot", cid: "QmXoyp...789", status: "Voting", votes: 12, total: 20 },
  { id: 2, type: "Vehicle", title: "Toyota Hilux 2024", cid: "QmZ3aB...456", status: "Approved", votes: 20, total: 20 },
  { id: 3, type: "Bill", title: "Hospital Fee: Member #08", cid: "QmWq2r...123", status: "Executed", votes: 18, total: 20 },
];

export default function TreasurerView() {
  const ipfsGateway = "https://gateway.pinata.cloud/ipfs/";

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-3xl font-serif gold-text">Treasurer’s Ledger</h2>
          <p className="text-gold-light/40 text-xs uppercase tracking-widest mt-2">Audit & Asset Verification Portal</p>
        </div>
        <div className="text-right glass-card px-6 py-3 rounded-2xl border-gold/10">
          <p className="text-[10px] text-gold/40 uppercase font-bold">Group Liquidity</p>
          <p className="text-2xl gold-text">142,500.00 USDC</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {auditLog.map((item) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-6 glass-card rounded-2xl border border-gold/5 flex flex-col md:flex-row justify-between items-center group hover:border-gold/30 transition-all"
          >
            <div className="flex items-center gap-6 w-full md:w-auto">
              <div className={`p-4 rounded-xl ${item.status === 'Approved' ? 'bg-green-500/10 text-green-500' : 'bg-gold/10 text-gold'}`}>
                {item.status === 'Executed' ? <CheckCircle2 /> : <ShieldAlert />}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-gold-light/30 uppercase font-black tracking-tighter">{item.type}</span>
                  <span className={`text-[8px] px-2 py-0.5 rounded-full border ${item.status === 'Approved' ? 'border-green-500/50 text-green-500' : 'border-gold/30 text-gold'}`}>
                    {item.status}
                  </span>
                </div>
                <h4 className="text-xl font-serif text-gold-light">{item.title}</h4>
              </div>
            </div>

            <div className="flex items-center gap-8 mt-6 md:mt-0 w-full md:w-auto justify-between">
              <div className="text-center">
                <p className="text-[10px] text-gold-light/20 uppercase mb-1">Voting Progress</p>
                <div className="flex items-center gap-2">
                   <span className="text-sm font-bold">{item.votes} / {item.total}</span>
                   <div className="w-24 h-1 bg-earth rounded-full overflow-hidden">
                      <div className="bg-gold h-full" style={{ width: `${(item.votes/item.total)*100}%` }} />
                   </div>
                </div>
              </div>

              <a 
                href={`${ipfsGateway}${item.cid}`} 
                target="_blank" 
                className="flex items-center gap-2 px-4 py-2 bg-earth/40 border border-gold/20 rounded-xl text-xs text-gold hover:bg-gold hover:text-earth-dark transition-all"
              >
                <Eye size={14} /> INSPECT DEED
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
