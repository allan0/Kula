"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from 'wagmi';
import Navbar from "@/components/Navbar";
import AssetVault from "@/components/AssetVault";
import TreasurerView from "@/components/TreasurerView";
import MemberDirectory from "@/components/MemberDirectory";
import GoldParticles from "@/components/GoldParticles";
import ExclusiveModal from "@/components/ExclusiveModal";
import KulaRoadmap from "@/components/KulaRoadmap";
import IdentityHub from "@/components/IdentityHub";
import GroupChatWall from "@/components/GroupChatWall";
import GrowthPulse from "@/components/GrowthPulse";
import { 
  Users, Landmark, Receipt, ShieldCheck, 
  Trophy, MessageCircle, PlusCircle 
} from "lucide-react";

export default function DashboardClient() {
  const [activeTab, setActiveTab] = useState<"rotary" | "assets" | "votes" | "treasurer" | "chat">("rotary");
  const [modalType, setModalType] = useState<string | null>(null);

  const { address, isConnected } = useAccount();

  const tabs = [
    { id: "rotary", label: "My Circle", icon: <Users size={16} /> },
    { id: "assets", label: "Asset Vault", icon: <Landmark size={16} /> },
    { id: "votes", label: "Voting Hall", icon: <Receipt size={16} /> },
    { id: "treasurer", label: "Treasurer", icon: <ShieldCheck size={16} /> },
    { id: "chat", label: "Circle Chat", icon: <MessageCircle size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F3E5AB] pb-24 overflow-x-hidden tg-safe-area">
      <GoldParticles />
      <Navbar />

      <main className="relative z-10 pt-28 px-5 md:px-8 max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#D4AF37] uppercase tracking-[0.4em] text-xs font-black mb-1">SOVEREIGN CIRCLE</p>
              <h1 className="text-5xl md:text-6xl font-serif tracking-tighter">
                The Kula <span className="shimmer-text">Vault</span>
              </h1>
            </div>
            
            {isConnected && (
              <div className="hidden md:flex items-center gap-3 text-xs font-mono text-[#D4AF37]/70">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
            )}
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto no-scrollbar gap-8 mb-10 border-b border-[#D4AF37]/10 pb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="group flex-shrink-0 flex flex-col items-center gap-2 relative pb-4"
            >
              <div className={`transition-all ${activeTab === tab.id ? 'text-[#D4AF37]' : 'text-[#F3E5AB]/50 group-hover:text-[#F3E5AB]/80'}`}>
                {tab.icon}
              </div>
              <span className={`text-xs font-black uppercase tracking-widest transition-colors ${activeTab === tab.id ? 'text-[#D4AF37]' : 'text-[#F3E5AB]/60'}`}>
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#D4AF37] rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            {/* ROTARY / CIRCLE VIEW */}
            {activeTab === "rotary" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                  <div className="glass-card rounded-[3rem] p-12">
                    <p className="uppercase text-xs tracking-[0.3em] text-[#D4AF37]">TOTAL TREASURY</p>
                    <p className="text-7xl md:text-8xl font-serif tracking-tighter mt-4">$142,500.00</p>
                    <GrowthPulse />
                  </div>

                  <KulaRoadmap />
                </div>

                <div className="lg:col-span-4">
                  <MemberDirectory />
                </div>
              </div>
            )}

            {/* ASSET VAULT */}
            {activeTab === "assets" && <AssetVault />}

            {/* VOTING HALL - Placeholder */}
            {activeTab === "votes" && (
              <div className="glass-card rounded-[3rem] p-12 text-center">
                <h3 className="text-3xl font-serif mb-6">Voting Hall</h3>
                <p className="text-[#F3E5AB]/60 mb-8">Active proposals will appear here.</p>
                <button 
                  onClick={() => setModalType('identity')}
                  className="btn-gold px-12 py-6 rounded-2xl text-sm font-black tracking-widest"
                >
                  CREATE NEW PROPOSAL
                </button>
              </div>
            )}

            {/* TREASURER VIEW */}
            {activeTab === "treasurer" && <TreasurerView />}

            {/* CIRCLE CHAT */}
            {activeTab === "chat" && <GroupChatWall />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setModalType('create')}
        className="fixed bottom-8 right-8 w-16 h-16 bg-[#D4AF37] text-[#0F0F0F] rounded-full flex items-center justify-center shadow-2xl shadow-[#D4AF37]/50 hover:scale-110 active:scale-95 transition-all z-50"
      >
        <PlusCircle size={28} strokeWidth={3} />
      </button>

      {/* Modals */}
      <ExclusiveModal 
        isOpen={modalType === 'identity'} 
        onClose={() => setModalType(null)} 
        title="Identity Vault"
      >
        <IdentityHub />
      </ExclusiveModal>

      <ExclusiveModal 
        isOpen={modalType === 'create'} 
        onClose={() => setModalType(null)} 
        title="Initialize New Circle"
      >
        {/* Placeholder for CreateGroupWizard */}
        <div className="py-12 text-center">
          <p className="text-2xl font-serif mb-6">Create Group Wizard</p>
          <p className="text-[#F3E5AB]/60">Coming soon — Full wizard integration in progress.</p>
        </div>
      </ExclusiveModal>
    </div>
  );
}
