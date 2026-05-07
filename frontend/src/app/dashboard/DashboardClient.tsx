"use client";

import { useState } from "react";
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
  Map, Send, Star, PlusCircle, Wallet, Trophy, MessageCircle
} from "lucide-react";

export default function DashboardClient() {
  const [activeTab, setActiveTab] = useState("rotary");
  const [modalType, setModalType] = useState<string | null>(null);

  const { writeContract } = useWriteContract();
  const { address, isConnected } = useAccount();

  const tabs = [
    { id: "rotary", label: "My Groups", desc: "Active Savings", icon: <Users size={14} /> },
    { id: "assets", label: "Asset Vault", desc: "Land & Luxury", icon: <Landmark size={14} /> },
    { id: "votes", label: "Voting Hall", desc: "Bills & Purchases", icon: <Receipt size={14} /> },
    { id: "treasurer", label: "Treasurer", desc: "Audit & Verify", icon: <ShieldCheck size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F3E5AB] pb-20 overflow-x-hidden">
      <GoldParticles />
      <Navbar />

      <main className="relative z-10 pt-32 px-4 md:px-20 max-w-7xl mx-auto">
        <header className="mb-12">
          <h2 className="text-[#D4AF37] uppercase tracking-[0.4em] text-[10px] font-black mb-2">Established Circle</h2>
          <h1 className="text-4xl md:text-7xl font-serif">The Kula <span className="shimmer-text italic">Vault</span></h1>
          {isConnected && <p className="text-[10px] text-[#D4AF37] mt-2 font-mono">Vault Key: {address}</p>}
        </header>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto no-scrollbar gap-12 mb-12 border-b border-[#D4AF37]/10 pb-4">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="group relative flex-shrink-0 text-left">
              <span className={`text-xs uppercase font-black transition-colors ${activeTab === tab.id ? 'text-[#D4AF37]' : 'text-[#F3E5AB]/40'}`}>
                {tab.label}
              </span>
              {activeTab === tab.id && <motion.div layoutId="tabLine" className="absolute -bottom-[17px] left-0 w-full h-[2px] bg-[#D4AF37]" />}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {activeTab === "rotary" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className="p-10 glass-card rounded-[3rem] border border-[#D4AF37]/20">
                        <p className="text-7xl md:text-9xl font-serif tracking-tighter leading-none">$142,500.00</p>
                    </div>
                </div>
                <div className="lg:col-span-1">
                  <MemberDirectory />
                </div>
              </div>
            )}
            {activeTab === "assets" && <AssetVault />}
            {activeTab === "treasurer" && <TreasurerView />}
          </motion.div>
        </AnimatePresence>

        <ExclusiveModal isOpen={modalType === 'identity'} onClose={() => setModalType(null)} title="Identity Vault">
          <IdentityHub />
        </ExclusiveModal>
      </main>
    </div>
  );
}
