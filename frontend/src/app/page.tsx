"use client";

import React, { useState, useEffect } from "react";
import { useAccount } from 'wagmi';
import Navbar from "@/components/Navbar";
import MemberDirectory from "@/components/MemberDirectory";
import GoldParticles from "@/components/GoldParticles";
import { Wallet, ArrowRight } from "lucide-react";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <div className="spinner w-12 h-12 border-4 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F3E5AB] pb-20 overflow-x-hidden tg-safe-area">
      <GoldParticles />
      <Navbar />

      <main className="relative z-10 pt-28 px-5 md:px-8 max-w-5xl mx-auto">
        {/* Hero Header */}
        <header className="text-center mb-16 pt-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-3 h-3 bg-[#D4AF37] rounded-full animate-pulse" />
            <p className="text-[#D4AF37] uppercase font-black text-xs tracking-[0.4em]">EST. 2025 • BASE L2</p>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-serif tracking-tighter leading-none mb-4">
            The Kula <span className="shimmer-text">Vault</span>
          </h1>
          
          <p className="text-[#F3E5AB]/70 max-w-md mx-auto text-lg">
            Sovereign collective wealth.<br />Real assets. Real trust.
          </p>

          {isConnected && (
            <p className="mt-6 text-xs font-mono text-[#D4AF37]/80 flex items-center justify-center gap-2">
              <Wallet size={14} /> {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          )}
        </header>

        {/* Main Portfolio Card */}
        <div className="glass-card rounded-[3rem] p-10 md:p-16 mb-12 border border-[#D4AF37]/20">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div>
              <p className="uppercase text-xs tracking-[0.3em] text-[#D4AF37] font-black mb-2">TOTAL GROUP WEALTH</p>
              <p className="text-6xl md:text-7xl font-serif text-white tracking-tighter">$142,500.00</p>
              <p className="text-green-500 text-sm mt-3 flex items-center gap-2">
                +8.42% APY <span className="text-[#D4AF37]/50">• Live on Aave</span>
              </p>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto">
              <button 
                onClick={() => window.scrollTo({ top: 800, behavior: 'smooth' })}
                className="btn-gold w-full md:w-auto px-10 py-5 rounded-2xl flex items-center justify-center gap-3 text-sm uppercase tracking-widest font-black"
              >
                Contribute Now <ArrowRight size={18} />
              </button>
              
              <button className="px-10 py-5 border border-[#D4AF37]/30 hover:border-[#D4AF37] rounded-2xl text-sm uppercase tracking-widest font-bold transition-all">
                View Full Ledger
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats + Member Directory */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Asset Preview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="glass-card rounded-3xl p-8 hover:border-[#D4AF37]/40 transition-all group">
                <div className="text-[#D4AF37] text-xs uppercase font-black tracking-widest mb-4">CURRENT HOLDING</div>
                <div className="text-2xl font-serif mb-1">Kitengela 5-Acre Plot</div>
                <div className="text-3xl gold-text font-bold">$45,000</div>
                <div className="text-xs text-green-500 mt-6">+200% Appreciation</div>
              </div>

              <div className="glass-card rounded-3xl p-8 hover:border-[#D4AF37]/40 transition-all group">
                <div className="text-[#D4AF37] text-xs uppercase font-black tracking-widest mb-4">NEXT PAYOUT</div>
                <div className="text-2xl font-serif mb-1">March 12th, 2026</div>
                <div className="text-3xl gold-text font-bold">$18,750</div>
                <div className="text-xs text-[#F3E5AB]/60 mt-6">To Member #04</div>
              </div>
            </div>
          </div>

          {/* Member Directory Sidebar */}
          <div className="lg:col-span-1">
            <MemberDirectory />
          </div>
        </div>

        {/* Call to Action for Telegram Mini App users */}
        <div className="mt-16 text-center">
          <p className="text-xs uppercase tracking-widest text-[#D4AF37]/60 mb-4">Ready to build generational wealth?</p>
          <button 
            className="btn-gold px-16 py-6 rounded-3xl text-base font-black tracking-widest shadow-xl shadow-[#D4AF37]/20"
            onClick={() => alert("Opening Create Group Wizard...")}
          >
            INITIALIZE YOUR CIRCLE
          </button>
        </div>
      </main>
    </div>
  );
}
