"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashLoader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0F0F0F] overflow-hidden"
        >
          {/* VIDEO BACKGROUND */}
          <div className="absolute inset-0 w-full h-full">
            <video
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-110 opacity-30 blur-[4px]"
            >
              <source src="/assets/kula.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-transparent to-[#0F0F0F]" />
          </div>
          
          {/* LOGO POSITIONING: Centered Flexbox */}
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="relative z-10 flex flex-col items-center justify-center text-center"
          >
             <div className="mb-8 p-6 rounded-full border border-[#D4AF37]/20 bg-[#0F0F0F]/40 backdrop-blur-2xl shadow-[0_0_50px_rgba(212,175,55,0.15)]">
                <img 
                  src="/assets/kulalogo.png" 
                  alt="KULA" 
                  className="w-24 md:w-36 h-auto" 
                />
             </div>
             <h1 className="gold-text text-5xl md:text-7xl font-serif uppercase tracking-[0.8em] ml-[0.8em]">
                KULA
             </h1>
             <p className="text-[#D4AF37]/40 text-[10px] uppercase tracking-[0.5em] mt-6">
                The Sovereign Treasury
             </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
