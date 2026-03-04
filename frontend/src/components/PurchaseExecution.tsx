"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ArrowRight, Wallet, Landmark, Gavel, Check } from "lucide-react";

export default function PurchaseExecution({ asset, onComplete }: any) {
  const [stage, setStage] = useState("review"); // review -> processing -> success

  const triggerExecution = () => {
    setStage("processing");
    // Simulate Blockchain TX
    setTimeout(() => setStage("success"), 4000);
  };

  return (
    <div className="py-4">
      <AnimatePresence mode="wait">
        {stage === "review" && (
          <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
            <div className="p-8 luxury-border rounded-[2rem] bg-gold/5 border-gold/30">
              <p className="text-[10px] text-gold uppercase font-black tracking-widest mb-4">Final Acquisition Summary</p>
              <div className="flex justify-between items-end">
                <div>
                  <h4 className="text-3xl font-serif text-gold-light">{asset.title}</h4>
                  <p className="text-sm text-gold-light/40 italic">{asset.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gold/40 uppercase font-bold">Execution Price</p>
                  <p className="text-2xl gold-text font-black">{asset.price}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 glass-card rounded-2xl border border-gold/10">
                <p className="text-[8px] text-gold-light/30 uppercase mb-2">Group Liquidity</p>
                <p className="text-sm font-bold">142,500 USDC</p>
              </div>
              <div className="p-4 glass-card rounded-2xl border border-gold/10">
                <p className="text-[8px] text-gold-light/30 uppercase mb-2">Community Votes</p>
                <p className="text-sm font-bold text-green-500">75% Quorum Met</p>
              </div>
            </div>

            <button 
              onClick={triggerExecution}
              className="w-full py-5 bg-gold text-earth-dark rounded-2xl font-black text-xs tracking-[0.3em] uppercase shadow-[0_20px_40px_rgba(212,175,55,0.2)] hover:scale-[1.02] transition-all"
            >
              EXECUTE SMART CONTRACT
            </button>
          </motion.div>
        )}

        {stage === "processing" && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-12 text-center">
            <motion.div 
              animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 border-t-2 border-gold rounded-full mb-8"
            />
            <h3 className="text-2xl font-serif shimmer-text mb-2">Signing Acquisition</h3>
            <p className="text-[10px] text-gold-light/40 uppercase tracking-[0.4em]">Transferring USDC • Escrowing RWA Title...</p>
          </motion.div>
        )}

        {stage === "success" && (
          <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center py-8 text-center">
            <div className="w-24 h-24 bg-gold rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(212,175,55,0.4)]">
              <Check size={48} className="text-earth-dark" strokeWidth={4} />
            </div>
            <h2 className="text-4xl font-serif gold-text mb-4">Ownership Secured</h2>
            <p className="text-sm text-gold-light/60 max-w-sm mb-10 leading-relaxed">
              The Title Deed has been tokenized and transferred to the Group Vault. All members now hold a fractional share of this asset.
            </p>
            <div className="flex gap-4 w-full">
              <button onClick={() => window.open('https://sepolia.basescan.org', '_blank')} className="flex-1 py-4 bg-earth-dark border border-gold/20 rounded-xl text-[10px] font-bold text-gold tracking-widest uppercase">View Ledger</button>
              <button onClick={onComplete} className="flex-1 py-4 bg-gold text-earth-dark rounded-xl text-[10px] font-black tracking-widest uppercase">Close Vault</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
