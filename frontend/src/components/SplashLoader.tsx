"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashLoader() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3200);

    // Smooth progress animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 12;
      });
    }, 80);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F0F0F] overflow-hidden"
        >
          {/* Cinematic Background Video */}
          <div className="absolute inset-0 w-full h-full">
            <video
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover scale-110 opacity-40"
            >
              <source src="/assets/kula.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#0F0F0F]/90 to-black/80" />
          </div>

          {/* Central Content */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-6">
            
            {/* Logo Container */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="mb-10"
            >
              <div className="relative p-8 rounded-full border border-[#D4AF37]/30 bg-black/40 backdrop-blur-3xl shadow-2xl shadow-[#D4AF37]/10">
                <img 
                  src="/assets/kulalogo.png" 
                  alt="KULA" 
                  className="w-28 md:w-36 h-auto drop-shadow-2xl" 
                />
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="gold-text text-6xl md:text-7xl font-serif tracking-[0.12em] mb-3"
            >
              KULA
            </motion.h1>

            <p className="text-[#D4AF37]/50 text-sm tracking-[0.4em] uppercase font-light mb-12">
              THE SOVEREIGN VAULT
            </p>

            {/* Progress Bar */}
            <div className="w-80 max-w-[280px]">
              <div className="h-[1px] bg-[#D4AF37]/20 relative overflow-hidden rounded">
                <motion.div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#D4AF37]/60 mt-3 font-mono tracking-widest">
                <span>INITIALIZING VAULT</span>
                <span>{Math.floor(progress)}%</span>
              </div>
            </div>
          </div>

          {/* Bottom Tagline */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            className="absolute bottom-12 text-center text-[#D4AF37]/40 text-xs tracking-[0.3em]"
          >
            ESTABLISHED ON BASE • POWERED BY TRUST
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
