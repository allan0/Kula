"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import GoldParticles from "@/components/GoldParticles";
import ExclusiveModal from "@/components/ExclusiveModal";
import KulaRoadmap from "@/components/KulaRoadmap";
import IdentityHub from "@/components/IdentityHub";
// Added Share2 and other missing icons to the import list
import { 
  Landmark, 
  Car, 
  Receipt, 
  Globe, 
  ShieldCheck, 
  Users, 
  Send, 
  Share2, 
  Map, 
  Trophy, 
  MessageCircle,
  Sparkles
} from "lucide-react";

const features = [
  { icon: <Users />, title: "The Circle", desc: "Traditional ROSCA logic secured by smart contracts. No middleman, just code." },
  { icon: <Landmark />, title: "Real Estate", desc: "Collectively purchase land and property. Deeds are verified and held in escrow." },
  { icon: <Car />, title: "Fleet Growth", desc: "Finance vehicles through group rotation. Logbooks are tokenized for group security." },
  { icon: <Receipt />, title: "Social Safety", desc: "Vote to settle hospital or school fees for members directly from group yield." },
  { icon: <Globe />, title: "USSD Access", desc: "Access the vault from any feature phone. No internet required for core savings." },
  { icon: <ShieldCheck />, title: "Asset Audit", desc: "Every physical asset is verified by legal oracles before group funds release." },
];

export default function Home() {
  const [modalType, setModalType] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-earth-dark selection:bg-gold selection:text-earth-dark">
      <GoldParticles />
      <Navbar />
      
      {/* HERO SECTION */}
      <section className="relative h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="z-10"
        >
          <h2 className="text-gold/60 text-[10px] md:text-xs tracking-[0.5em] uppercase mb-6 font-black">
            Established 2026 • Private Beta
          </h2>
          <h1 className="text-6xl md:text-9xl font-serif shimmer-text mb-8 tracking-tighter">
            KULA
          </h1>
          <p className="text-gold-light/40 max-w-2xl mx-auto mb-12 text-sm md:text-lg leading-relaxed font-light tracking-wide px-6">
            A prestigious decentralized treasury for elite circles. 
            Transform collective savings into real-world legacies.
          </p>
          
          <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
            <motion.a
              href="/dashboard"
              whileHover={{ scale: 1.05 }}
              className="inline-block px-12 py-4 bg-gold text-earth-dark rounded-full font-black tracking-widest text-xs shadow-[0_0_30px_rgba(212,175,55,0.2)] transition-all"
            >
              ENTER THE VAULT
            </motion.a>
            
            <button 
              onClick={() => setModalType('roadmap')}
              className="text-gold-light/40 hover:text-gold transition-colors text-[10px] font-black tracking-[0.3em] uppercase flex items-center gap-2"
            >
              <Map size={14} /> View Roadmap
            </button>
          </div>
        </motion.div>

        {/* Decorative background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[120px] pointer-events-none" />
      </section>

      {/* FUNCTIONALITY CARDS SECTION */}
      <section className="relative z-10 py-32 px-6 md:px-20 bg-gradient-to-b from-transparent to-earth-dark/80">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 text-center">
            <h3 className="gold-text text-[10px] font-black tracking-[0.5em] uppercase mb-4">Functional Suite</h3>
            <h2 className="text-4xl md:text-6xl font-serif text-gold-light">One Vault. Infinite <span className="italic opacity-60">Trust.</span></h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-10 glass-card rounded-[3rem] border border-gold/5 group hover:border-gold/20 transition-all cursor-default"
              >
                <div className="w-14 h-14 bg-gold/5 rounded-2xl flex items-center justify-center text-gold mb-8 group-hover:scale-110 group-hover:bg-gold group-hover:text-earth-dark transition-all duration-500 border border-gold/10">
                  {f.icon}
                </div>
                <h4 className="text-2xl font-serif text-gold-light mb-4 tracking-tight">{f.title}</h4>
                <p className="text-gold-light/40 text-sm leading-relaxed tracking-wide">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-24 text-center border-t border-gold/5">
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 bg-gold/20 rounded-full blur-md" />
          <img src="/assets/kulalogo.png" alt="K" className="relative w-10 h-10 grayscale opacity-40 mx-auto" />
        </div>
        <p className="text-gold-light/20 text-[9px] tracking-[0.6em] uppercase font-black">
          Sovereign Digital Trust • Built on Base L2
        </p>
      </footer>

      {/* --- MODALS --- */}
      
      {/* ROADMAP MODAL */}
      <ExclusiveModal 
        isOpen={modalType === 'roadmap'} 
        onClose={() => setModalType(null)} 
        title="Project Roadmap"
      >
        <KulaRoadmap />
      </ExclusiveModal>

      {/* TELEGRAM MODAL (This is where the Share2 error was) */}
      <ExclusiveModal 
        isOpen={modalType === 'telegram'} 
        onClose={() => setModalType(null)} 
        title="Telegram Intelligence"
      >
        <div className="text-center p-10 bg-earth-dark/40 rounded-[3rem] border border-gold/10">
          <Send size={56} className="mx-auto text-gold mb-6 opacity-80" />
          <h4 className="text-2xl font-serif mb-4 text-gold-light">Sync Your Circle</h4>
          <p className="text-sm mb-8 text-gold-light/40 leading-relaxed max-w-sm mx-auto">
            Connect your Telegram to scrape group channel metadata and verify member goals before treasury releases.
          </p>
          <button className="w-full py-5 bg-[#229ED9] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-[#229ED9]/20 hover:scale-105 transition-transform flex items-center justify-center gap-3">
            {/* Share2 is now defined because of the import above */}
            <Share2 size={18} /> Link @KulaBot
          </button>
        </div>
      </ExclusiveModal>

    </div>
  );
}
