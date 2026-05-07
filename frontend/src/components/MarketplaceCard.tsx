"use client";

import { motion } from "framer-motion";
import { MapPin, ShieldCheck, TrendingUp, ArrowUpRight } from "lucide-react";

interface AssetProps {
  type: string;
  title: string;
  location: string;
  price: string;
  image: string;
  votes: number;
  status?: "Certified" | "Pending";
}

export default function MarketplaceCard({ 
  type, 
  title, 
  location, 
  price, 
  image, 
  votes,
  status = "Certified" 
}: AssetProps) {
  const progress = Math.min((votes / 25) * 100, 100);

  return (
    <motion.div 
      whileHover={{ y: -12, transition: { duration: 0.4 } }}
      className="glass-card rounded-3xl overflow-hidden border border-[#D4AF37]/10 group cursor-pointer h-full flex flex-col"
    >
      {/* Image Section */}
      <div className="relative h-56 overflow-hidden">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        />
        
        <div className="absolute top-4 left-4 px-4 py-1.5 bg-black/70 backdrop-blur-md rounded-2xl border border-[#D4AF37]/30 text-xs font-black tracking-widest uppercase">
          {type}
        </div>

        {status === "Certified" && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-green-500/90 text-black text-[10px] font-black px-3 py-1 rounded-2xl">
            <ShieldCheck size={14} /> CERTIFIED
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-8 flex-1 flex flex-col">
        <div className="flex-1">
          <h3 className="text-2xl font-serif text-white mb-3 leading-tight">{title}</h3>
          
          <div className="flex items-center gap-2 text-[#F3E5AB]/70 text-sm mb-6">
            <MapPin size={16} />
            <span>{location}</span>
          </div>

          <div className="mb-8">
            <p className="text-xs uppercase tracking-widest text-[#D4AF37]/70 mb-1">TARGET POT</p>
            <p className="text-4xl font-serif gold-text tracking-tighter">{price}</p>
          </div>
        </div>

        {/* Voting Progress */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-2 text-[#F3E5AB]/60">
              <span>COMMUNITY SUPPORT</span>
              <span className="font-mono">{votes}/25</span>
            </div>
            <div className="h-1.5 bg-[#D4AF37]/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB]"
              />
            </div>
          </div>

          <button className="w-full py-5 bg-[#D4AF37] hover:bg-white text-black font-black text-sm tracking-widest rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95">
            VOTE TO ACQUIRE
            <ArrowUpRight size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
