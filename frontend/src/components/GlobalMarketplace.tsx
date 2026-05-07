"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ArrowUpRight, Sparkles, Gem, MapPin } from "lucide-react";

const publicAssets = [
  { 
    id: 101, 
    title: "Nanyuki 10-Acre Ranch", 
    price: "85,000 USDC", 
    votes: 142, 
    status: "Certified", 
    minted: false,
    location: "Laikipia, Kenya"
  },
  { 
    id: 102, 
    title: "Vintage Porsche 911 Carrera", 
    price: "120,000 USDC", 
    votes: 45, 
    status: "Pending", 
    minted: false,
    location: "Nairobi, Kenya"
  },
  { 
    id: 103, 
    title: "Prime CBD Commercial Space", 
    price: "250,000 USDC", 
    votes: 310, 
    status: "Certified", 
    minted: true,
    location: "Nairobi CBD"
  },
];

export default function GlobalMarketplace() {
  const [isMinting, setIsMinting] = useState<number | null>(null);

  const handleMint = (id: number) => {
    setIsMinting(id);
    setTimeout(() => {
      setIsMinting(null);
      alert(`✅ Trust Equity NFT #${id} minted successfully!`);
    }, 2600);
  };

  return (
    <div className="space-y-12">
      <header className="flex justify-between items-end">
        <div>
          <h3 className="text-4xl font-serif gold-text">Global Asset Registry</h3>
          <p className="text-[#F3E5AB]/60">Community Certified • On-chain Real World Assets</p>
        </div>
        <div className="text-xs px-5 py-2 border border-[#D4AF37]/30 rounded-full font-mono tracking-widest">BASE SEPOLIA</div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {publicAssets.map((asset) => (
          <motion.div 
            key={asset.id}
            whileHover={{ y: -10 }}
            className={`glass-card rounded-[2.75rem] p-8 flex flex-col transition-all group ${
              asset.minted ? 'border-[#D4AF37] shadow-xl shadow-[#D4AF37]/20' : 'border-[#D4AF37]/10 hover:border-[#D4AF37]/40'
            }`}
          >
            <div className="relative h-52 bg-gradient-to-br from-[#1B1212] to-black rounded-3xl mb-8 flex items-center justify-center overflow-hidden">
              <div className="text-[180px] font-serif text-[#D4AF37]/5 absolute">K</div>
              <div className="absolute top-6 left-6 text-xs uppercase tracking-widest bg-black/70 px-4 py-2 rounded-2xl border border-[#D4AF37]/30">
                {asset.location}
              </div>
            </div>

            <h4 className="text-2xl font-serif text-white mb-3">{asset.title}</h4>
            <p className="text-4xl font-serif gold-text mb-8">{asset.price}</p>

            <div className="mt-auto">
              <div className="flex justify-between text-xs mb-3 text-[#F3E5AB]/60">
                <span>COMMUNITY VERIFICATION</span>
                <span>{asset.votes}/50</span>
              </div>
              <div className="h-1.5 bg-[#D4AF37]/10 rounded-full mb-8 overflow-hidden">
                <motion.div 
                  animate={{ width: `${Math.min((asset.votes / 50) * 100, 100)}%` }}
                  className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB]"
                />
              </div>

              {asset.minted ? (
                <button className="w-full py-5 border border-[#D4AF37] text-[#D4AF37] rounded-2xl font-black tracking-widest flex items-center justify-center gap-2 hover:bg-[#D4AF37] hover:text-black transition-all">
                  VIEW ON BASESCAN <ArrowUpRight size={18} />
                </button>
              ) : asset.status === "Certified" ? (
                <button 
                  onClick={() => handleMint(asset.id)}
                  disabled={isMinting !== null}
                  className="w-full py-5 bg-[#D4AF37] text-black rounded-2xl font-black tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70"
                >
                  {isMinting === asset.id ? "MINTING..." : "MINT TRUST EQUITY NFT"} <Sparkles size={18} />
                </button>
              ) : (
                <button className="w-full py-5 border border-[#D4AF37]/30 text-[#D4AF37] rounded-2xl font-black tracking-widest">
                  VOTE TO CERTIFY
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Global Minting Overlay */}
      <AnimatePresence>
        {isMinting && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl"
          >
            <div className="text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.5 }} className="w-20 h-20 border-4 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full mx-auto mb-8" />
              <h2 className="text-4xl font-serif shimmer-text">Minting Trust Equity</h2>
              <p className="text-[#F3E5AB]/60 mt-3">Securing fractional ownership on-chain...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
