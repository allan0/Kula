"use client";
import { motion } from "framer-motion";
import { MapPin, ShieldCheck, TrendingUp } from "lucide-react";

interface AssetProps {
  type: string;
  title: string;
  location: string;
  price: string;
  image: string;
  votes: number;
}

export default function MarketplaceCard({ type, title, location, price, image, votes }: AssetProps) {
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="glass-card rounded-3xl overflow-hidden border border-gold/10 group"
    >
      <div className="relative h-48 overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute top-4 left-4 px-3 py-1 bg-earth-dark/80 backdrop-blur-md rounded-full border border-gold/30 text-[10px] text-gold tracking-widest uppercase">
          {type}
        </div>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-serif text-gold-light mb-1">{title}</h3>
            <div className="flex items-center gap-1 text-gold-light/40 text-xs">
              <MapPin size={12} /> {location}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gold-light/40 uppercase">Target Pot</p>
            <p className="gold-text text-lg">{price}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="w-full bg-earth-dark/50 rounded-full h-1.5 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(votes / 20) * 100}%` }}
              className="h-full bg-gold"
            />
          </div>
          
          <div className="flex justify-between items-center text-[10px] text-gold-light/40 tracking-widest uppercase">
            <span>{votes} / 20 Votes</span>
            <span className="flex items-center gap-1 text-gold"><ShieldCheck size={10} /> Verified Deed</span>
          </div>

          <button className="w-full py-3 bg-gold/10 hover:bg-gold hover:text-earth-dark border border-gold/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
            VOTE TO PURCHASE
          </button>
        </div>
      </div>
    </motion.div>
  );
}
