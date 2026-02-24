"use client";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import GoldParticles from "@/components/GoldParticles";
import { Landmark, Car, Receipt, Globe, ShieldCheck, Users } from "lucide-react";

const features = [
  { icon: <Users />, title: "The Circle", desc: "Traditional ROSCA logic secured by smart contracts. No middleman, just code." },
  { icon: <Landmark />, title: "Real Estate", desc: "Collectively purchase land and property. Deeds are verified and held in escrow." },
  { icon: <Car />, title: "Fleet Growth", desc: "Finance vehicles through group rotation. Logbooks are tokenized for group security." },
  { icon: <Receipt />, title: "Social Safety", desc: "Vote to settle hospital or school fees for members directly from group yield." },
  { icon: <Globe />, title: "USSD Access", desc: "Access the vault from any feature phone. No internet required for core savings." },
  { icon: <ShieldCheck />, title: "Asset Audit", desc: "Every physical asset is verified by legal oracles before group funds release." },
];

export default function Home() {
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
          <h2 className="text-gold/60 text-[10px] md:text-xs tracking-[0.5em] uppercase mb-6">Established 2026 • Private Beta</h2>
          <h1 className="text-6xl md:text-9xl font-serif shimmer-text mb-8">KULA</h1>
          <p className="text-gold-light/40 max-w-2xl mx-auto mb-12 text-sm md:text-lg leading-relaxed font-light tracking-wide px-6">
            A prestigious decentralized treasury for elite circles. 
            Transform collective savings into real-world legacies.
          </p>
          <motion.a
            href="/dashboard"
            whileHover={{ scale: 1.05 }}
            className="inline-block px-12 py-4 bg-earth rounded-full border border-gold/40 text-gold font-bold tracking-widest hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] transition-all"
          >
            REQUEST ACCESS
          </motion.a>
        </motion.div>
      </section>

      {/* FUNCTIONALITY CARDS SECTION */}
      <section className="relative z-10 py-32 px-6 md:px-20 bg-gradient-to-b from-transparent to-earth-dark/80">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 text-center">
            <h3 className="gold-text text-sm tracking-[0.4em] uppercase mb-4">Functional Suite</h3>
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
                className="p-8 glass-card rounded-[2.5rem] border border-gold/5 group hover:border-gold/30 transition-all cursor-default"
              >
                <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center text-gold mb-6 group-hover:scale-110 group-hover:bg-gold group-hover:text-earth-dark transition-all duration-500">
                  {f.icon}
                </div>
                <h4 className="text-2xl font-serif text-gold-light mb-4">{f.title}</h4>
                <p className="text-gold-light/40 text-sm leading-relaxed tracking-tight">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-20 text-center border-t border-gold/5">
        <img src="/assets/kulalogo.png" alt="K" className="w-8 h-8 opacity-30 mx-auto mb-6 grayscale" />
        <p className="text-gold-light/20 text-[10px] tracking-[0.5em] uppercase">Built on Base L2 • Secure Digital Trust</p>
      </footer>
    </div>
  );
}
