"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashLoader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 5000); // Adjust to video length
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-earth-dark"
        >
          <video
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover opacity-80"
          >
            <source src="/assets/kula.mp4" type="video/mp4" />
          </video>
          
          {/* Subtle Overlay to blend with colors */}
          <div className="absolute inset-0 bg-gradient-to-t from-earth-dark via-transparent to-earth-dark opacity-60" />
          
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="absolute"
          >
             <img src="/assets/kulalogo.png" alt="KULA" className="w-48 h-auto drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
