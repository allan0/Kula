"use client";
import { motion } from "framer-motion";
import { FilePlus, Car, Landmark, UploadCloud } from "lucide-react";

export default function AssetVault() {
  return (
    <div className="p-8 glass-card rounded-3xl border border-gold/20 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-serif gold-text mb-2">Tokenize Real-World Assets</h2>
        <p className="text-gold-light/60">Upload verified deeds or logbooks to the Kula Smart Contract.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Zone */}
        <motion.div 
          whileHover={{ borderColor: "#D4AF37" }}
          className="border-2 border-dashed border-gold/20 rounded-2xl p-10 flex flex-col items-center justify-center bg-earth-dark/40 cursor-pointer"
        >
          <UploadCloud size={48} className="text-gold mb-4" />
          <p className="text-sm text-gold-light uppercase tracking-widest font-bold">Drop Documents Here</p>
          <p className="text-xs text-gold-light/40 mt-2">PDF, JPG, PNG (Max 10MB)</p>
        </motion.div>

        {/* Asset Type Select */}
        <div className="space-y-4">
          <div className="p-4 bg-earth/30 rounded-xl border border-gold/10 flex items-center gap-4 hover:border-gold/40 cursor-pointer transition-all">
            <div className="p-3 bg-gold/10 rounded-lg text-gold"><Landmark /></div>
            <div>
              <p className="font-bold">Property Title Deed</p>
              <p className="text-xs text-gold-light/50">Land, Residential, Commercial</p>
            </div>
          </div>
          <div className="p-4 bg-earth/30 rounded-xl border border-gold/10 flex items-center gap-4 hover:border-gold/40 cursor-pointer transition-all">
            <div className="p-3 bg-gold/10 rounded-lg text-gold"><Car /></div>
            <div>
              <p className="font-bold">Vehicle Logbook</p>
              <p className="text-xs text-gold-light/50">Private or Commercial Fleet</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
