"use client";
import { motion } from "framer-motion";
import { Wallet, ShieldCheck } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 px-8 py-6 flex justify-between items-center backdrop-blur-md border-b border-gold/10">
      <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-2">
        <img src="/assets/kulalogo.png" alt="KULA" className="w-12 h-12" />
        <span className="text-2xl font-serif tracking-widest gold-text uppercase">Kula</span>
      </motion.div>

      <motion.button
        whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(212, 175, 55, 0.3)" }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-gold-dark to-gold rounded-full text-earth-dark font-bold tracking-tighter shadow-lg"
      >
        <Wallet size={18} />
        ENTER VAULT
      </motion.button>
    </nav>
  );
}
