"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import AssetVault from "@/components/AssetVault";
import { ScrollArea } from "lucide-react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("rotary");

  const tabs = [
    { id: "rotary", label: "My Groups", desc: "Active Savings" },
    { id: "assets", label: "Asset Vault", desc: "Land & Luxury" },
    { id: "votes", label: "Voting Hall", desc: "Bills & Purchases" },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 px-4 md:px-20">
      <Navbar />
      
      {/* Exclusive Tab Switcher */}
      <div className="flex justify-center gap-8 mb-16">
        {tabs.map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="group relative px-4 py-2"
          >
            <span className={`text-sm tracking-widest uppercase transition-colors ${activeTab === tab.id ? 'text-gold' : 'text-gold-light/40'}`}>
              {tab.label}
            </span>
            <p className="text-[10px] text-gold-light/20 uppercase tracking-tighter text-center">{tab.desc}</p>
            {activeTab === tab.id && (
              <motion.div layoutId="underline" className="absolute -bottom-2 left-0 w-full h-[2px] bg-gold" />
            )}
          </button>
        ))}
      </div>

      {/* Main Content Area with Smooth Animation */}
      <motion.div
        key={activeTab}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {activeTab === "rotary" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 glass-card rounded-3xl border border-gold/20 h-64 flex flex-col justify-between">
               <h3 className="gold-text text-xl">Active Rotation</h3>
               <p className="text-4xl font-serif">$12,400</p>
               <button className="w-full py-2 bg-gold/10 border border-gold/30 rounded-full text-xs font-bold hover:bg-gold hover:text-earth-dark transition-all">CONTRIBUTE</button>
            </div>
            {/* Repeat cards or dynamic data here */}
          </div>
        )}

        {activeTab === "assets" && <AssetVault />}

        {activeTab === "votes" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-6 glass-card rounded-2xl flex justify-between items-center border-l-4 border-gold">
              <div>
                <p className="text-gold text-xs uppercase font-bold">Proposal #42</p>
                <h4 className="text-xl">Purchase: 5-Acre Plot (Kitengela)</h4>
                <p className="text-gold-light/50">Status: Voting Active • 12/20 Votes Received</p>
              </div>
              <button className="px-8 py-3 bg-gold text-earth-dark rounded-xl font-bold">VOTE YES</button>
            </div>

            <div className="p-6 glass-card rounded-2xl flex justify-between items-center border-l-4 border-earth-light">
              <div>
                <p className="text-gold-light/50 text-xs uppercase font-bold">Proposal #41</p>
                <h4 className="text-xl">Bill: School Fees Support (Member #04)</h4>
                <p className="text-gold-light/30 italic">Approved • Disbursing 1,200 USDC</p>
              </div>
              <span className="text-green-500 font-bold">PAID</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
