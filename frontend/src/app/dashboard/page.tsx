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
  Trophy, MessageCircle, Map, Send, 
  Star, PlusCircle, Wallet,
  CheckCircle2, Share2
} from "lucide-react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("rotary");
  const [modalType, setModalType] = useState<string | null>(null);
  const { writeContract } = useWriteContract();
  const { address } = useAccount();

  const tabs = [
    { id: "rotary", label: "My Groups", desc: "Active Savings", icon: <Users size={14} /> },
    { id: "assets", label: "Asset Vault", desc: "Land & Luxury", icon: <Landmark size={14} /> },
    { id: "votes", label: "Voting Hall", desc: "Bills & Purchases", icon: <Receipt size={14} /> },
    { id: "treasurer", label: "Treasurer", desc: "Audit & Verify", icon: <ShieldCheck size={14} /> },
  ];

  const handleVote = (proposalId: number) => {
    if (!address) return alert("Please connect your vault key first.");
    writeContract({
      abi: [
        {
          "inputs": [{ "internalType": "uint256", "name": "_proposalId", "type": "uint256" }],
          "name": "voteOnProposal",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ],
      address: '0xFfAB10611EF65d877Db508Fe9e7111Bb1C759Af8',
      functionName: 'voteOnProposal',
      args: [BigInt(proposalId)],
    });
  };

  return (
    <div className="min-h-screen bg-earth-dark text-gold-light selection:bg-gold selection:text-earth-dark pb-20 overflow-x-hidden">
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
              <span className="text-gold group-hover:rotate-12 transition-transform">{item.icon}</span>
              <span className="text-[9px] font-black tracking-[0.2em] uppercase">{item.label}</span>
            </motion.button>
          ))}
        </div>

        {/* 2. PAGE HEADER */}
        <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <motion.h2 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-gold uppercase tracking-[0.4em] text-[10px] font-black mb-2">
              Established Circle • Group #01
            </motion.h2>
            <motion.h1 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="text-4xl md:text-7xl font-serif text-gold-light tracking-tight">
              The Kula <span className="shimmer-text italic">Vault</span>
            </motion.h1>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 px-8 py-4 bg-gold text-earth-dark rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase shadow-[0_15px_30px_rgba(212,175,55,0.2)]"
          >
            <PlusCircle size={18} /> Create New Circle
          </motion.button>
        </header>

        {/* 3. TAB NAVIGATION */}
        <div className="flex overflow-x-auto no-scrollbar gap-6 md:gap-12 mb-12 border-b border-gold/10 pb-4">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="group relative flex-shrink-0 text-left outline-none">
              <div className="flex items-center gap-2 mb-1">
                <span className={activeTab === tab.id ? 'text-gold' : 'text-gold-light/30'}>{tab.icon}</span>
                <span className={`text-xs tracking-[0.2em] uppercase font-black transition-colors ${activeTab === tab.id ? 'text-gold' : 'text-gold-light/40 group-hover:text-gold-light'}`}>
                  {tab.label}
                </span>
              </div>
              <p className="text-[9px] text-gold-light/20 uppercase tracking-tighter whitespace-nowrap">{tab.desc}</p>
              {activeTab === tab.id && (
                <motion.div layoutId="activeTabUnderline" className="absolute -bottom-[17px] left-0 w-full h-[2px] bg-gold shadow-[0_0_10px_#D4AF37]" />
              )}
            </button>
          ))}
        </div>

        {/* 4. MAIN CONTENT AREA */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* ROTARY TAB */}
            {activeTab === "rotary" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                  <div className="p-10 glass-card rounded-[3rem] flex flex-col justify-between min-h-[380px] relative overflow-hidden group border border-gold/20">
                     <div className="relative z-10">
                        <div className="flex justify-between items-start">
                           <h3 className="gold-text text-xl uppercase tracking-[0.3em] mb-2 font-bold">Total Savings Pool</h3>
                           <div className="flex items-center gap-2 text-gold/60 text-[10px] font-bold uppercase tracking-widest bg-earth-dark/50 px-3 py-1 rounded-full border border-gold/10">
                              <Wallet size={12}/> Base Sepolia
                           </div>
                        </div>
                        <p className="text-7xl md:text-9xl font-serif text-gold-light mb-4 tracking-tighter leading-none">$142,500.00</p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-[10px] text-green-500 font-bold uppercase tracking-widest">
                            <Star size={10} fill="currentColor" /> Active Yield: 8.4%
                          </div>
                          <span className="text-gold-light/30 text-[10px] uppercase font-bold tracking-widest">Payout Cycle: Monthly</span>
                        </div>
                     </div>
                     <div className="flex gap-4 mt-12 relative z-10">
                       <button className="flex-1 py-5 bg-gold text-earth-dark rounded-2xl font-black text-xs tracking-[0.2em] uppercase hover:bg-gold-light transition-all shadow-xl">CONTRIBUTE</button>
                       <button className="flex-1 py-5 bg-earth/40 border border-gold/30 text-gold rounded-2xl font-black text-xs tracking-[0.2em] uppercase hover:bg-gold/10 transition-all">INVITE TO CIRCLE</button>
                     </div>
                     <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-gold/5 rounded-full blur-3xl group-hover:bg-gold/10 transition-all" />
                  </div>
                  
                  {/* Rewards Banner */}
                  <div className="p-8 luxury-border rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                      <h4 className="text-2xl font-serif text-gold-light">KULA Loyalty Rewards</h4>
                      <p className="text-gold-light/30 text-[10px] uppercase font-bold tracking-widest mt-1">Staking Rewards for on-time contributions</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-4xl font-serif gold-text">1,240.00 KULA</span>
                      <button className="px-8 py-3 bg-gold/5 border border-gold/20 rounded-full text-[10px] font-black text-gold hover:bg-gold hover:text-earth-dark transition-all uppercase tracking-widest">Claim</button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <MemberDirectory />
                </div>
              </div>
            )}

            {/* ASSETS TAB */}
            {activeTab === "assets" && (
              <div className="space-y-16">
                <AssetVault />
                <div>
                  <div className="flex items-center gap-4 mb-10">
                    <div className="h-[1px] flex-1 bg-gold/10"></div>
                    <h3 className="text-xl font-serif gold-text tracking-[0.3em] uppercase">Executive Acquisitions</h3>
                    <div className="h-[1px] flex-1 bg-gold/10"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <MarketplaceCard type="Real Estate" title="5-Acre Kitengela Plot" location="Kajiado, Kenya" price="45,000 USDC" image="https://images.unsplash.com/photo-1500382017468-9049fed747ef" votes={14} />
                    <MarketplaceCard type="Vehicle" title="Toyota Hilux 2024" location="Nairobi, KE" price="32,000 USDC" image="https://images.unsplash.com/photo-1621236304192-ef2f967f6004" votes={8} />
                    <MarketplaceCard type="Luxury" title="Mombasa Beach Apartment" location="Nyali, KE" price="85,000 USDC" image="https://images.unsplash.com/photo-1512917774080-9991f1c4c750" votes={3} />
                  </div>
                </div>
              </div>
            )}

            {/* VOTING TAB */}
            {activeTab === "votes" && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-12 text-center">
                  <h3 className="text-4xl font-serif gold-text">The Voting Hall</h3>
                  <p className="text-gold-light/40 text-sm tracking-wide mt-2 uppercase tracking-[0.2em]">Collective treasury decisions for Group #01</p>
                </div>

                <div className="p-10 glass-card rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center border-l-4 border-gold gap-8 group">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-0.5 bg-gold text-earth-dark text-[9px] font-black uppercase rounded tracking-tighter">Urgent</span>
                      <p className="text-gold text-[10px] uppercase font-black tracking-widest">Proposal #42</p>
                    </div>
                    <h4 className="text-3xl font-serif mb-3 group-hover:text-gold transition-colors">Disbursement: Kitengela Plot</h4>
                    <p className="text-gold-light/50 text-sm leading-relaxed">Approval to release 15,000 USDC from the treasury for the final settlement of the group land acquisition.</p>
                  </div>
                  <button 
                    onClick={() => handleVote(42)} 
                    className="w-full md:w-auto px-12 py-5 bg-gold text-earth-dark rounded-2xl font-black text-xs tracking-[0.2em] uppercase shadow-[0_15px_30px_rgba(212,175,55,0.2)] hover:scale-105 active:scale-95 transition-all"
                  >
                    VOTE YES
                  </button>
                </div>

                <div className="p-10 glass-card rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center border-l-4 border-earth-light opacity-60 gap-8 grayscale hover:grayscale-0 transition-all">
                  <div className="flex-1">
                    <p className="text-gold-light/40 text-[10px] uppercase font-black tracking-widest mb-3">Proposal #41</p>
                    <h4 className="text-3xl font-serif mb-3">Bill Settlement: Member #04</h4>
                    <p className="text-gold-light/40 text-sm leading-relaxed italic">Settlement of medical fees at Nairobi Hospital. Disbursed via group yield reserve.</p>
                  </div>
                  <div className="px-8 py-3 rounded-full border border-green-500/30 text-green-500 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={14} /> EXECUTED
                  </div>
                </div>
              </div>
            )}

            {/* TREASURER TAB */}
            {activeTab === "treasurer" && <TreasurerView />}
          </motion.div>
        </AnimatePresence>

        {/* MODAL POPUPS */}
        <ExclusiveModal isOpen={modalType === 'roadmap'} onClose={() => setModalType(null)} title="Evolution Roadmap">
          <KulaRoadmap />
        </ExclusiveModal>

        <ExclusiveModal isOpen={modalType === 'identity'} onClose={() => setModalType(null)} title="Identity Vault">
          <IdentityHub />
        </ExclusiveModal>

        <ExclusiveModal isOpen={modalType === 'leaderboard'} onClose={() => setModalType(null)} title="Global Leaderboard">
          <div className="space-y-4">
             {[
               { rank: 1, name: "Nairobi High Circle", score: 99.8, volume: "1.2M", members: 12 },
               { rank: 2, name: "Base Builders Group", score: 98.2, volume: "850k", members: 8 },
               { rank: 3, name: "The Founders Circle", score: 95.5, volume: "500k", members: 5 },
             ].map((group) => (
               <div key={group.rank} className="p-6 luxury-border rounded-3xl flex justify-between items-center hover:bg-gold/5 transition-all cursor-default">
                 <div className="flex items-center gap-6">
                   <span className="text-3xl font-serif text-gold/30 italic">0{group.rank}</span>
                   <div>
                     <p className="font-bold text-lg tracking-tight">{group.name}</p>
                     <p className="text-[10px] text-gold-light/30 uppercase tracking-widest">{group.members} Elite Members</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <p className="text-gold font-black text-xl">{group.score}%</p>
                   <p className="text-[9px] text-gold-light/20 uppercase font-bold tracking-tighter">Trust Rating</p>
                 </div>
               </div>
             ))}
          </div>
        </ExclusiveModal>

        <ExclusiveModal isOpen={modalType === 'chat'} onClose={() => setModalType(null)} title="Group Intelligence">
          <div className="flex flex-col h-[400px]">
             <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar">
                <div className="flex flex-col items-start gap-1 max-w-[80%]">
                   <p className="text-[8px] text-gold uppercase ml-2">Treasurer (0x71C...)</p>
                   <div className="bg-earth/40 p-4 rounded-2xl rounded-tl-none border border-gold/10 text-xs">
                      The deed for the Kitengela plot is now in the Asset Vault. Please inspect and vote.
                   </div>
                </div>
                <div className="flex flex-col items-end gap-1 ml-auto max-w-[80%]">
                   <p className="text-[8px] text-gold-light/40 uppercase mr-2">You</p>
                   <div className="bg-gold text-earth-dark p-4 rounded-2xl rounded-tr-none text-xs font-bold shadow-lg">
                      Received. Reviewing the IPFS hash now.
                   </div>
                </div>
             </div>
             <div className="mt-6 flex gap-3">
                <input type="text" placeholder="Encrypt message..." className="flex-1 bg-earth-dark border border-gold/20 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-gold/50 transition-all"/>
                <button className="p-3 bg-gold rounded-xl text-earth-dark hover:scale-105 transition-transform"><Send size={18}/></button>
             </div>
          </div>
        </ExclusiveModal>

        <ExclusiveModal isOpen={modalType === 'telegram'} onClose={() => setModalType(null)} title="Telegram Intelligence">
          <div className="text-center p-10 bg-earth-dark/40 rounded-[3rem] border border-gold/10">
            <Send size={56} className="mx-auto text-gold mb-6 opacity-80" />
            <h4 className="text-2xl font-serif mb-4">Sync Your Circle</h4>
            <p className="text-sm mb-8 text-gold-light/40 leading-relaxed max-w-sm mx-auto">Connect your Telegram to scrape group channel metadata and verify member goals before treasury releases.</p>
            <button className="w-full py-5 bg-[#229ED9] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-[#229ED9]/20 hover:scale-105 transition-transform flex items-center justify-center gap-3">
              <Share2 size={18} /> Link @KulaAuditBot
            </button>
          </div>
        </ExclusiveModal>

      </main>
    </div>
  );
}
