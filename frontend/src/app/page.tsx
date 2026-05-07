"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import GoldParticles from "@/components/GoldParticles";
import ExclusiveModal from "@/components/ExclusiveModal";
import { 
  Landmark, 
  Car, 
  Receipt, 
  Globe, 
  ShieldCheck, 
  Users, 
  Send, 
  Share2, 
  ArrowRight,
  TrendingUp,
  Smartphone,
  QrCode
} from "lucide-react";

const features = [
  { icon: <Users />, title: "The Circle", desc: "Traditional ROSCA logic secured by smart contracts. No middleman, just pure code." },
  { icon: <Landmark />, title: "Real Estate", desc: "Collectively purchase land and property. Deeds are verified and held in digital escrow." },
  { icon: <Car />, title: "Fleet Growth", desc: "Finance vehicles through group rotation. Logbooks are tokenized for group security." },
  { icon: <Receipt />, title: "Social Safety", desc: "Vote to settle hospital or school fees for members directly from group yield." },
  { icon: <Globe />, title: "USSD Access", desc: "Access the vault from any feature phone. No internet required for core savings." },
  { icon: <ShieldCheck />, title: "Asset Audit", desc: "Every physical asset is verified by legal oracles before group funds release." },
];

export default function Home() {
  const [modalType, setModalType] = useState<string | null>(null);

  // Replace this with your actual Expo EAS download link
  const mobileDownloadUrl = "https://expo.dev/artifacts/eas/your-unique-app-link";

  return (
    <div className="min-h-screen bg-earth-dark selection:bg-gold selection:text-earth-dark overflow-x-hidden">
      <GoldParticles />
      <Navbar />
      
      {/* 1. HERO SECTION */}
      <section className="relative h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="z-10"
        >
          <div className="flex justify-center mb-6">
             <span className="px-4 py-1 rounded-full border border-gold/30 bg-gold/5 text-[9px] text-gold font-black uppercase tracking-[0.3em] animate-pulse">
                Base L2 Network • Secure Genesis
             </span>
          </div>
          <h1 className="text-7xl md:text-9xl font-serif shimmer-text mb-8">KULA</h1>
          <p className="text-gold-light/40 max-w-2xl mx-auto mb-12 text-sm md:text-lg leading-relaxed font-light tracking-wide px-6">
            The Sovereign Treasury for elite circles. 
            Transforming collective social trust into real-world legacies.
          </p>
          
          <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
            {/* WEB APP BUTTON */}
            <motion.a
              href="/dashboard"
              whileHover={{ scale: 1.05 }}
              className="px-12 py-4 bg-gold text-earth-dark rounded-full font-black tracking-widest text-xs shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all"
            >
              ENTER THE VAULT
            </motion.a>

            {/* NEW: MOBILE DOWNLOAD BUTTON */}
            <motion.a
              href={mobileDownloadUrl}
              target="_blank"
              whileHover={{ scale: 1.05, backgroundColor: "rgba(212, 175, 55, 0.1)" }}
              className="px-8 py-4 luxury-border rounded-full flex items-center gap-3 group transition-all"
            >
              <Smartphone size={16} className="text-gold group-hover:animate-bounce" />
              <span className="text-gold font-black tracking-widest text-[10px] uppercase">Download Mobile Vault</span>
            </motion.a>
          </div>

          <div className="mt-10">
            <button 
              onClick={() => setModalType('telegram')}
              className="text-gold-light/40 hover:text-gold transition-colors text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 mx-auto"
            >
              Link @KulaBot <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* 2. FUNCTIONALITY CARDS SECTION */}
      <section className="relative z-10 py-32 px-6 md:px-20 bg-gradient-to-b from-transparent to-earth-dark/95">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 text-center">
            <h3 className="gold-text text-[10px] tracking-[0.5em] uppercase mb-4">The Functional Suite</h3>
            <h2 className="text-4xl md:text-6xl font-serif text-gold-light">One Vault. Infinite <span className="italic">Trust.</span></h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-10 glass-card rounded-[3rem] border border-gold/5 group hover:border-gold/30 transition-all cursor-default relative overflow-hidden"
              >
                <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center text-gold mb-8 group-hover:scale-110 group-hover:bg-gold group-hover:text-earth-dark transition-all duration-500">
                  {f.icon}
                </div>
                <h4 className="text-2xl font-serif text-gold-light mb-4">{f.title}</h4>
                <p className="text-gold-light/40 text-sm leading-relaxed tracking-tight">
                  {f.desc}
                </p>
                <TrendingUp className="absolute -right-4 -bottom-4 text-gold/5 group-hover:text-gold/10 transition-colors" size={100} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. MODALS */}
      <ExclusiveModal 
        isOpen={modalType === 'telegram'} 
        onClose={() => setModalType(null)} 
        title="Telegram Intelligence"
      >
        <div className="text-center p-10 bg-earth-dark/40 rounded-[3rem] border border-gold/10">
          <Send size={56} className="mx-auto text-gold mb-6 opacity-80" />
          <h4 className="text-2xl font-serif mb-4 text-gold-light uppercase tracking-widest">Sync Your Circle</h4>
          <p className="text-sm mb-8 text-gold-light/40 leading-relaxed max-w-sm mx-auto">
            Link your circle's Telegram channel to scrape group metadata and build cross-platform reputation scores before treasury releases.
          </p>
          <button className="w-full py-5 bg-[#229ED9] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-[#229ED9]/20 hover:scale-105 transition-transform flex items-center justify-center gap-3">
            <Share2 size={18} /> Link @KulaAuditBot
          </button>
        </div>
      </ExclusiveModal>

      {/* 4. FOOTER */}
      <footer className="py-20 text-center border-t border-gold/5 bg-earth-dark/50">
        <img src="/assets/kulalogo.png" alt="K" className="w-10 h-10 opacity-30 mx-auto mb-6 grayscale brightness-200" />
        <p className="text-gold-light/20 text-[10px] tracking-[0.6em] uppercase">Digitized Trust • Sovereign Wealth • 2026</p>
      </footer>
    </div>
  );
}
