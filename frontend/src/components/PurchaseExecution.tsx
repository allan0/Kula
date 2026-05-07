"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ArrowRight, Wallet, Landmark, Gavel, Check, ExternalLink } from "lucide-react";

export default function PurchaseExecution({ 
  asset, 
  onComplete 
}: { 
  asset: any; 
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<"review" | "processing" | "success">("review");

  const triggerExecution = () => {
    setStage("processing");

    // Simulate blockchain execution
    setTimeout(() => {
      setStage("success");
    }, 3800);
  };

  return (
    <div className="py-4">
      <AnimatePresence mode="wait">
        {/* Review Stage */}
        {stage === "review" && (
          <motion.div 
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-10"
          >
            <div className="luxury-border rounded-[2.5rem] p-10 bg-gradient-to-br from-[#1B1212] to-black">
              <p className="uppercase text-xs tracking-[0.4em] text-[#D4AF37] font-black mb-6">FINAL EXECUTION SUMMARY</p>
              
              <div className="flex flex-col md:flex-row justify-between gap-8">
                <div className="flex-1">
                  <h3 className="text-4xl font-serif text-white mb-3">{asset?.title || "Premium Asset"}</h3>
                  <p className="text-[#F3E5AB]/70 text-lg">{asset?.location || "Nairobi Metropolitan"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest text-[#D4AF37]/70">EXECUTION PRICE</p>
                  <p className="text-5xl font-serif gold-text">{asset?.price || "$85,000"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-8 rounded-3xl">
                <p className="text-xs uppercase tracking-widest text-[#D4AF37]/60 mb-3">GROUP LIQUIDITY</p>
                <p className="text-4xl font-serif">142,500 USDC</p>
              </div>
              <div className="glass-card p-8 rounded-3xl">
                <p className="text-xs uppercase tracking-widest text-[#D4AF37]/60 mb-3">VOTES RECEIVED</p>
                <p className="text-4xl font-serif text-green-500">19/20</p>
              </div>
              <div className="glass-card p-8 rounded-3xl">
                <p className="text-xs uppercase tracking-widest text-[#D4AF37]/60 mb-3">QUORUM</p>
                <p className="text-4xl font-serif">95%</p>
              </div>
            </div>

            <button 
              onClick={triggerExecution}
              className="w-full py-8 bg-gradient-to-r from-[#D4AF37] to-[#E8C670] text-black font-black text-xl tracking-widest rounded-3xl flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-[#D4AF37]/30"
            >
              EXECUTE SMART CONTRACT <Gavel size={28} />
            </button>
          </motion.div>
        )}

        {/* Processing Stage */}
        {stage === "processing" && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
              className="w-24 h-24 border-4 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full mb-10"
            />
            <h3 className="text-4xl font-serif shimmer-text">EXECUTING TRANSACTION</h3>
            <p className="text-[#F3E5AB]/60 mt-4 max-w-sm">
              Transferring USDC • Escrowing Title Deed • Minting fractional shares
            </p>
          </motion.div>
        )}

        {/* Success Stage */}
        {stage === "success" && (
          <motion.div 
            key="success"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center text-center py-16"
          >
            <div className="w-28 h-28 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-10 shadow-[0_0_80px_rgba(74,222,128,0.5)]">
              <Check size={64} className="text-black" strokeWidth={4} />
            </div>

            <h2 className="text-5xl font-serif text-white mb-4">Ownership Secured</h2>
            <p className="text-[#F3E5AB]/70 max-w-md leading-relaxed">
              The asset has been successfully tokenized and transferred to the Kula Group Vault. 
              All members now hold proportional equity.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mt-12">
              <button 
                onClick={() => window.open('https://sepolia.basescan.org', '_blank')}
                className="flex-1 py-6 border border-[#D4AF37]/40 hover:bg-white/5 rounded-3xl text-sm font-black tracking-widest flex items-center justify-center gap-3"
              >
                VIEW ON BASESCAN <ExternalLink size={18} />
              </button>
              <button 
                onClick={onComplete}
                className="flex-1 py-6 bg-[#D4AF37] text-black rounded-3xl font-black tracking-widest"
              >
                RETURN TO VAULT
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
