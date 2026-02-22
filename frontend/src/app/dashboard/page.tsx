"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import AssetVault from "@/components/AssetVault";
import MarketplaceCard from "@/components/MarketplaceCard";
import GoldParticles from "@/components/GoldParticles";
import { Wallet, Landmark, Car, Receipt, Users } from "lucide-react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("rotary");

  const tabs = [
    { id: "rotary", label: "My Groups", desc: "Active Savings", icon: <Users size={14} /> },
    { id: "assets", label: "Asset Vault", desc: "Land & Luxury", icon: <Landmark size={14} /> },
    { id: "votes", label: "Voting Hall", desc: "Bills & Purchases", icon: <Receipt size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-earth-dark text-gold-light selection:bg-gold selection:text-earth-dark pb-20 overflow-x-hidden">
      {/* Visual Layer: Particles & Global Nav */}
      <GoldParticles />
      <Navbar />

      <main className="relative z-10 pt-32 px-4 md:px-20 max-w-7xl mx-auto">
        
        {/* Header Section */}
        <header className="mb-12">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-2"
          >
            Executive Member Portal
          </motion.h2>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-serif text-gold-light"
          >
            The Kula <span className="gold-text italic">Vault</span>
          </motion.h1>
        </header>

        {/* Horizontal Tab Navigation */}
        <div className="flex overflow-x-auto no-scrollbar gap-4 md:gap-12 mb-12 border-b border-gold/10 pb-4">
          {tabs.map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="group relative flex-shrink-0 text-left transition-all outline-none"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={activeTab === tab.id ? 'text-gold' : 'text-gold-light/40'}>
                  {tab.icon}
                </span>
                <span className={`text-sm tracking-widest uppercase font-bold transition-colors ${activeTab === tab.id ? 'text-gold' : 'text-gold-light/40 group-hover:text-gold-light'}`}>
                  {tab.label}
                </span>
              </div>
              <p className="text-[10px] text-gold-light/20 uppercase tracking-tighter whitespace-nowrap">{tab.desc}</p>
              
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTabUnderline" 
                  className="absolute -bottom-[17px] left-0 w-full h-[2px] bg-gold shadow-[0_0_10px_#D4AF37]" 
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* TAB: MY GROUPS */}
            {activeTab === "rotary" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Pot Card */}
                <div className="md:col-span-2 p-10 glass-card rounded-[2rem] flex flex-col justify-between min-h-[350px] relative overflow-hidden group">
                   <div className="relative z-10">
                      <h3 className="gold-text text-xl uppercase tracking-widest mb-2">Portfolio Value</h3>
                      <p className="text-6xl md:text-8xl font-serif text-gold-light mb-4 leading-none tracking-tighter">$12,400.00</p>
                      <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[10px] font-bold tracking-widest uppercase border border-green-500/20">
                        +12.4% Yield Generated
                      </span>
                   </div>
                   <div className="flex gap-4 mt-8 relative z-10">
                     <button className="flex-1 py-4 bg-gold text-earth-dark rounded-2xl font-black text-sm tracking-widest hover:bg-gold-light transition-all">CONTRIBUTE</button>
                     <button className="flex-1 py-4 bg-earth/40 border border-gold/30 text-gold rounded-2xl font-bold text-sm tracking-widest hover:bg-gold/10 transition-all">WITHDRAW</button>
                   </div>
                   {/* Abstract circle in background */}
                   <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-gold/5 rounded-full blur-3xl group-hover:bg-gold/10 transition-all" />
                </div>

                {/* Group Stats Sidebar */}
                <div className="space-y-6">
                  <div className="p-6 glass-card rounded-[2rem] border border-gold/10">
                    <p className="text-[10px] text-gold/50 uppercase font-black mb-4 tracking-widest">Active Members</p>
                    <div className="flex -space-x-3 mb-4">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="w-10 h-10 rounded-full bg-earth border-2 border-gold-dark flex items-center justify-center text-[10px] font-bold text-gold">M0{i}</div>
                      ))}
                      <div className="w-10 h-10 rounded-full bg-gold-dark border-2 border-gold flex items-center justify-center text-[10px] font-bold text-earth-dark">+15</div>
                    </div>
                    <p className="text-xs text-gold-light/40 italic">7 members are due for contribution today.</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ASSET VAULT */}
            {activeTab === "assets" && (
              <div className="space-y-12">
                {/* Upload Section */}
                <AssetVault />
                
                {/* Marketplace Grid */}
                <div>
                  <h3 className="text-2xl font-serif gold-text mb-8">Verified Group Acquisitions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <MarketplaceCard 
                      type="Real Estate"
                      title="5-Acre Kitengela Plot"
                      location="Kajiado, Kenya"
                      price="45,000 USDC"
                      image="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1000"
                      votes={12}
                    />
                    <MarketplaceCard 
                      type="Vehicle"
                      title="Toyota Hilux 2024"
                      location="Nairobi, KE"
                      price="32,000 USDC"
                      image="https://images.unsplash.com/photo-1621236304192-ef2f967f6004?q=80&w=1000"
                      votes={8}
                    />
                    <MarketplaceCard 
                      type="Residential"
                      title="Lavington Modern Villa"
                      location="Lavington, Nairobi"
                      price="120,000 USDC"
                      image="https://images.unsplash.com/photo-1613490493576-7fde63acd811?q=80&w=1000"
                      votes={3}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: VOTING HALL */}
            {activeTab === "votes" && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-10">
                  <h3 className="text-3xl font-serif gold-text">Active Proposals</h3>
                  <p className="text-gold-light/40">Collective decisions on purchases and member support.</p>
                </div>

                <div className="p-8 glass-card rounded-[2rem] flex flex-col md:flex-row justify-between items-center border-l-4 border-gold gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] bg-gold text-earth-dark px-2 py-0.5 rounded font-black uppercase tracking-tighter">Urgent</span>
                      <p className="text-gold text-xs uppercase font-bold tracking-widest">Proposal #42</p>
                    </div>
                    <h4 className="text-2xl font-serif mb-2">Final Payment: Kitengela Plot</h4>
                    <p className="text-gold-light/50 text-sm">Disbursement of 15,000 USDC to secure the title deed for group ownership.</p>
                  </div>
                  <button className="w-full md:w-auto px-10 py-4 bg-gold text-earth-dark rounded-2xl font-black text-sm tracking-widest shadow-[0_10px_20px_rgba(212,175,55,0.2)] hover:scale-105 transition-transform">
                    APPROVE
                  </button>
                </div>

                <div className="p-8 glass-card rounded-[2rem] flex flex-col md:flex-row justify-between items-center border-l-4 border-earth-light opacity-60 gap-6">
                  <div>
                    <p className="text-gold-light/50 text-xs uppercase font-bold tracking-widest mb-1">Proposal #41</p>
                    <h4 className="text-2xl font-serif mb-2">Member Support: School Fees</h4>
                    <p className="text-gold-light/30 text-sm italic italic">Member #04 requested support for Q1 Tuition.</p>
                  </div>
                  <div className="px-6 py-2 bg-green-500/10 border border-green-500/30 text-green-500 rounded-full font-bold text-xs tracking-widest uppercase">
                    Executed
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
