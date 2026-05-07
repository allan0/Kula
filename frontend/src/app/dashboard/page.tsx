"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWriteContract, useAccount } from 'wagmi';
import Navbar from "@/components/Navbar";
import AssetVault from "@/components/AssetVault";
import MarketplaceCard from "@/components/MarketplaceCard";
import GoldParticles from "@/components/GoldParticles";
import TreasurerView from "@/components/TreasurerView";
import MemberDirectory from "@/components/MemberDirectory";
import ExclusiveModal from "@/components/ExclusiveModal";
import KulaRoadmap from "@/components/KulaRoadmap";
import IdentityHub from "@/components/IdentityHub";
import { 
  Users, Landmark, Receipt, ShieldCheck, 
  Trophy, MessageCircle, Map, Send, 
  Star, PlusCircle, Wallet,
  CheckCircle2, Share2
} from "lucide-react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("rotary");
  const [modalType, setModalType] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const { writeContract } = useWriteContract();
  const { address } = useAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  const tabs = [
    { id: "rotary", label: "My Groups", desc: "Active Savings", icon: <Users size={14} /> },
    { id: "assets", label: "Asset Vault", desc: "Land & Luxury", icon: <Landmark size={14} /> },
    { id: "votes", label: "Voting Hall", desc: "Bills & Purchases", icon: <Receipt size={14} /> },
    { id: "treasurer", label: "Treasurer", desc: "Audit & Verify", icon: <ShieldCheck size={14} /> },
  ];

  if (!mounted) return <div className="min-h-screen bg-[#0F0F0F]" />;

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F3E5AB] selection:bg-[#D4AF37] selection:text-[#0F0F0F] pb-20 overflow-x-hidden">
      <GoldParticles />
      <Navbar />

      <main className="relative z-10 pt-32 px-4 md:px-20 max-w-7xl mx-auto">
        
        {/* 1. TOP ACTION HUB */}
        <div className="flex flex-wrap gap-3 md:gap-4 mb-12">
          {[
            { id: 'roadmap', icon: <Map size={16} />, label: 'Roadmap' },
            { id: 'leaderboard', icon: <Trophy size={16} />, label: 'Rankings' },
            { id: 'identity', icon: <ShieldCheck size={16} />, label: 'Verification' },
            { id: 'chat', icon: <MessageCircle size={16} />, label: 'Messages' },
            { id: 'telegram', icon: <Send size={16} />, label: 'Telegram' },
          ].map((item) => (
            <motion.button 
              key={item.id}
              whileHover={{ scale: 1.05, backgroundColor: "rgba(212, 175, 55, 0.1)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setModalType(item.id)}
              className="px-5 py-3 luxury-border rounded-2xl flex items-center gap-3 group transition-all shadow-lg"
            >
              <span className="text-[#D4AF37] group-hover:rotate-12 transition-transform">{item.icon}</span>
              <span className="text-[9px] font-black tracking-[0.2em] uppercase">{item.label}</span>
            </motion.button>
          ))}
        </div>

        {/* 2. PAGE HEADER */}
        <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h2 className="text-[#D4AF37] uppercase tracking-[0.4em] text-[10px] font-black mb-2">
              Established Circle • Group #01
            </h2>
            <h1 className="text-4xl md:text-7xl font-serif text-[#F3E5AB] tracking-tight">
              The Kula <span className="shimmer-text italic">Vault</span>
            </h1>
          </div>
          <button className="flex items-center gap-3 px-8 py-4 bg-[#D4AF37] text-[#0F0F0F] rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase shadow-[0_15px_30px_rgba(212,175,55,0.2)]">
            <PlusCircle size={18} /> Create New Circle
          </button>
        </header>

        {/* 3. TAB NAVIGATION */}
        <div className="flex overflow-x-auto no-scrollbar gap-6 md:gap-12 mb-12 border-b border-[#D4AF37]/10 pb-4">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="group relative flex-shrink-0 text-left outline-none">
              <div className="flex items-center gap-2 mb-1">
                <span className={activeTab === tab.id ? 'text-[#D4AF37]' : 'text-[#F3E5AB]/30'}>{tab.icon}</span>
                <span className={`text-xs tracking-[0.2em] uppercase font-black transition-colors ${activeTab === tab.id ? 'text-[#D4AF37]' : 'text-[#F3E5AB]/40 group-hover:text-[#F3E5AB]'}`}>
                  {tab.label}
                </span>
              </div>
              <p className="text-[9px] text-[#F3E5AB]/20 uppercase tracking-tighter whitespace-nowrap">{tab.desc}</p>
              {activeTab === tab.id && (
                <motion.div layoutId="activeTabUnderline" className="absolute -bottom-[17px] left-0 w-full h-[2px] bg-[#D4AF37] shadow-[0_0_10px_#D4AF37]" />
              )}
            </button>
          ))}
        </div>

        {/* 4. MAIN CONTENT AREA */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === "rotary" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                  <div className="p-10 glass-card rounded-[3rem] flex flex-col justify-between min-h-[380px] relative overflow-hidden group border border-[#D4AF37]/20">
                     <div className="relative z-10">
                        <div className="flex justify-between items-start">
                           <h3 className="gold-text text-xl uppercase tracking-[0.3em] mb-2 font-bold">Total Savings Pool</h3>
                           <div className="flex items-center gap-2 text-[#D4AF37]/60 text-[10px] font-bold uppercase tracking-widest bg-earth-dark/50 px-3 py-1 rounded-full border border-[#D4AF37]/10">
                              <Wallet size={12}/> Base Sepolia
                           </div>
                        </div>
                        <p className="text-7xl md:text-9xl font-serif text-[#F3E5AB] mb-4 tracking-tighter leading-none">$142,500.00</p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-[10px] text-green-500 font-bold uppercase tracking-widest">
                            <Star size={10} fill="currentColor" /> Active Yield: 8.4%
                          </div>
                        </div>
                     </div>
                     <div className="flex gap-4 mt-12 relative z-10">
                       <button className="flex-1 py-5 bg-[#D4AF37] text-[#0F0F0F] rounded-2xl font-black text-xs tracking-[0.2em] uppercase shadow-xl">CONTRIBUTE</button>
                       <button className="flex-1 py-5 bg-[#3E2723]/40 border border-[#D4AF37]/30 text-[#D4AF37] rounded-2xl font-black text-xs tracking-[0.2em] uppercase">INVITE TO CIRCLE</button>
                     </div>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <MemberDirectory />
                </div>
              </div>
            )}

            {activeTab === "assets" && <AssetVault />}
            {activeTab === "treasurer" && <TreasurerView />}
            {activeTab === "votes" && (
                <div className="p-10 glass-card rounded-[2rem] text-center border border-gold/10">
                    <Receipt size={48} className="mx-auto text-gold mb-4 opacity-50" />
                    <h3 className="text-2xl font-serif mb-2">No Active Proposals</h3>
                    <p className="text-xs text-gold-light/40 uppercase tracking-widest">The treasury is currently balanced.</p>
                </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* MODAL POPUPS */}
        <ExclusiveModal isOpen={modalType === 'roadmap'} onClose={() => setModalType(null)} title="Evolution Roadmap">
          <KulaRoadmap />
        </ExclusiveModal>

        <ExclusiveModal isOpen={modalType === 'identity'} onClose={() => setModalType(null)} title="Identity Vault">
          <IdentityHub />
        </ExclusiveModal>

      </main>
    </div>
  );
}
