"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Users, ArrowUpRight, BarChart3, Sparkles, Gem } from "lucide-react";

const publicAssets = [
  { id: 101, title: "Nanyuki 10-Acre Ranch", price: "85,000 USDC", votes: 142, status: "Certified", minted: false },
  { id: 102, title: "Vintage Porsche 911", price: "120,000 USDC", votes: 45, status: "Pending", minted: false },
  { id: 103, title: "Commercial Space - CBD", price: "250,000 USDC", votes: 310, status: "Certified", minted: true },
];

export default function GlobalMarketplace() {
  const [isMinting, setIsMinting] = useState(false);

  const handleMint = () => {
    setIsMinting(true);
    setTimeout(() => {
      setIsMinting(false);
      alert("Success! Your Asset has been Tokenized as a KULA-RWA NFT.");
    }, 3000);
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-3xl font-serif gold-text uppercase tracking-widest">Global Asset Registry</h3>
          <p className="text-gold-light/40 text-xs mt-2 uppercase tracking-tighter">Community-Verified Wealth for the Kula Treasury</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {publicAssets.map((asset) => (
          <motion.div 
            key={asset.id}
            whileHover={{ y: -10 }}
            className={`p-8 glass-card rounded-[2.5rem] border flex flex-col justify-between min-h-[350px] transition-all duration-500 ${
              asset.minted ? 'border-gold shadow-[0_0_40px_rgba(212,175,55,0.15)]' : 'border-gold/10'
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-6">
                <span className="text-[9px] text-gold/50 font-black uppercase tracking-widest">Vault ID: {asset.id}</span>
                {asset.minted ? (
                  <div className="flex items-center gap-2 text-gold animate-pulse">
                    <Gem size={14} />
                    <span className="text-[8px] font-black uppercase tracking-widest">RWA Tokenized</span>
                  </div>
                ) : asset.status === "Certified" && (
                  <div className="flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded-full text-[8px] font-bold uppercase border border-green-500/20">
                    <ShieldCheck size={10} /> Certified
                  </div>
                )}
              </div>
              <h4 className="text-3xl font-serif text-gold-light mb-2">{asset.title}</h4>
              <p className="text-xl gold-text font-bold tracking-tight">{asset.price}</p>
            </div>

            <div className="mt-10 space-y-6">
              <div>
                <div className="flex justify-between text-[9px] uppercase font-bold text-gold-light/30 mb-2 tracking-widest">
                  <span>Community Verification</span>
                  <span>{asset.votes}/50 Votes</span>
                </div>
                <div className="w-full h-1 bg-gold/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((asset.votes/50)*100, 100)}%` }}
                    className={`h-full ${asset.status === 'Certified' ? 'bg-gold shadow-[0_0_15px_#D4AF37]' : 'bg-gold-dark'}`}
                  />
                </div>
              </div>

              {/* ACTION BUTTON: Dynamic based on status */}
              {asset.minted ? (
                <button className="w-full py-4 bg-gold text-earth-dark rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  View On BaseScan <ArrowUpRight size={14} />
                </button>
              ) : asset.status === "Certified" ? (
                <button 
                  onClick={handleMint}
                  className="w-full py-4 shimmer-text border border-gold rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gold hover:text-earth-dark transition-all"
                >
                  {isMinting ? "Generating NFT..." : "Mint Trust Equity"} <Sparkles size={14} />
                </button>
              ) : (
                <button className="w-full py-4 bg-gold/5 border border-gold/20 rounded-2xl text-[10px] font-black text-gold uppercase tracking-widest hover:bg-gold/10 transition-all">
                  Verify Asset
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Minting Overlay Animation */}
      <AnimatePresence>
        {isMinting && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-earth-dark/90 backdrop-blur-xl"
          >
            <div className="text-center">
              <motion.div 
                animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 border-t-2 border-b-2 border-gold rounded-full mx-auto mb-8 shadow-[0_0_30px_rgba(212,175,55,0.3)]"
              />
              <h2 className="text-3xl font-serif shimmer-text mb-2">Tokenizing Property</h2>
              <p className="text-gold-light/40 text-[10px] uppercase tracking-[0.4em]">Securing Deed into KULA Registry...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
