"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function GoldParticles() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Generate elegant floating particles
  const particles = Array.from({ length: 24 });

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F3E5AB] opacity-20"
          style={{
            width: Math.random() * 5 + 2 + "px",
            height: Math.random() * 5 + 2 + "px",
            left: Math.random() * 100 + "%",
            top: Math.random() * 100 + "%",
          }}
          animate={{
            y: [0, -180, 0],
            x: [0, Math.random() * 60 - 30, 0],
            opacity: [0.15, 0.45, 0.15],
            scale: [0.6, 1.1, 0.6],
          }}
          transition={{
            duration: Math.random() * 18 + 14,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * -0.8,
          }}
        />
      ))}

      {/* Subtle larger ambient orbs */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={`orb-${i}`}
          className="absolute rounded-full bg-[#D4AF37] blur-3xl"
          style={{
            width: Math.random() * 80 + 60 + "px",
            height: Math.random() * 80 + 60 + "px",
            left: Math.random() * 100 + "%",
            top: Math.random() * 70 + "%",
            opacity: 0.04,
          }}
          animate={{
            y: [0, -60, 0],
            opacity: [0.03, 0.07, 0.03],
          }}
          transition={{
            duration: Math.random() * 25 + 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
