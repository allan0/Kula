"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashLoader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0F0F0F] overflow-hidden"
        >
          {/* Background Video - Properly Scaled */}
          <div className="absolute inset-0 w-full h-full">
            <video
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-105 blur-[2px] opacity-40"
            >
              <source src="/assets/kula.mp4" type="video/mp4" />
            </video>
            {/* Cinematic Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0F0F0F] via-transparent to-[#0F0F0F]" />
          </div>
          
          {/* Logo Reveal - Centered with Glow */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 1.5, ease: "easeOut" }}
            className="relative z-10 flex flex-col items-center"
          >
             <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border border-[#D4AF37]/30 flex items-center justify-center bg-[#0F0F0F]/50 backdrop-blur-xl shadow-[0_0_50px_rgba(212,175,55,0.2)] mb-8">
                <img 
                  src="/assets/kulalogo.png" 
                  alt="KULA" 
                  className="w-20 md:w-32 h-auto object-contain" 
                />
             </div>
             <h1 className="gold-text text-4xl md:text-6xl font-serif uppercase tracking-[1em] ml-[1em]">KULA</h1>
             <motion.p 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 2 }}
               className="text-[#D4AF37]/40 text-[10px] uppercase tracking-[0.5em] mt-4"
             >
               The Sovereign Treasury
             </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
