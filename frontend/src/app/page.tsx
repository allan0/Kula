"use client";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center">
      <Navbar />
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-gold rounded-full blur-[150px]" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-earth-light rounded-full blur-[150px]" />
      </div>

      {/* Hero Section */}
      <motion.div 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 4.5, duration: 1 }} // Wait for splash to finish
        className="text-center z-10 px-4"
      >
        <h2 className="text-gold-light text-sm tracking-[0.4em] uppercase mb-4">The Private Vault</h2>
        <h1 className="text-5xl md:text-8xl font-serif gold-text mb-8">
          Secure Your <br /> Future Together
        </h1>
        
        <p className="text-gold-light/60 max-w-xl mx-auto mb-12 text-lg leading-relaxed font-light">
          KULA is an exclusive blockchain-powered rotary circle. 
          Contribute, save, and vote to purchase verified property and assets with community trust.
        </p>

        <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
          <motion.a
            href="/dashboard"
            whileHover={{ scale: 1.05 }}
            className="px-12 py-4 bg-earth rounded-full border border-gold/40 text-gold font-bold tracking-widest hover:bg-earth-light transition-all"
          >
            OPEN DASHBOARD
          </motion.a>
          
          <button className="text-gold-light/40 hover:text-gold transition-colors text-xs tracking-widest uppercase">
            Learn About Governance
          </button>
        </div>
      </motion.div>

      {/* Footer Scroll Hint */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 5.5 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-[10px] text-gold/30 tracking-widest uppercase">Explore Assets</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-gold/40 to-transparent" />
      </motion.div>
    </div>
  );
}
