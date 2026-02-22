"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashLoader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Increase timer if your video is longer
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-earth-dark overflow-hidden"
        >
          {/* Main Video Background */}
          <div className="absolute inset-0 w-full h-full">
            <video
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover pointer-events-none"
            >
              <source src="/assets/kula.mp4" type="video/mp4" />
            </video>
            
            {/* Dark Cinematic Vignette */}
            <div className="absolute inset-0 bg-radial-[circle_at_center,_transparent_0%,_rgba(27,18,18,0.8)_100%] border-none" />
          </div>
          
          {/* Logo Reveal */}
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, letterSpacing: "0.2em" }}
            animate={{ scale: 1, opacity: 1, letterSpacing: "0.5em" }}
            transition={{ delay: 1, duration: 2 }}
            className="relative z-10 flex flex-col items-center"
          >
             <img 
               src="/assets/kulalogo.png" 
               alt="KULA" 
               className="w-32 md:w-48 h-auto drop-shadow-[0_0_20px_rgba(212,175,55,0.4)] mb-4" 
             />
             <h1 className="gold-text text-3xl md:text-5xl font-serif uppercase tracking-[1em]">KULA</h1>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
