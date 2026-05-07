"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ExclusiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function ExclusiveModal({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: ExclusiveModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 40 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
          >
            <div 
              className="glass-card w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-[3rem] pointer-events-auto border border-[#D4AF37]/30 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center px-10 pt-10 pb-6 border-b border-[#D4AF37]/10">
                <h3 className="text-3xl font-serif tracking-tight text-[#F3E5AB]">
                  {title}
                </h3>
                <button 
                  onClick={onClose}
                  className="p-3 hover:bg-[#D4AF37]/10 rounded-2xl transition-colors text-[#D4AF37]/70 hover:text-[#D4AF37]"
                >
                  <X size={28} strokeWidth={2.5} />
                </button>
              </div>

              {/* Content Area */}
              <div className="p-10 md:p-12 overflow-y-auto max-h-[calc(92vh-120px)] custom-scroll">
                {children}
              </div>

              {/* Footer Bar */}
              <div className="px-10 py-8 border-t border-[#D4AF37]/10 flex justify-center">
                <button 
                  onClick={onClose}
                  className="px-16 py-4 border border-[#D4AF37]/30 hover:bg-[#D4AF37] hover:text-[#0F0F0F] rounded-2xl text-sm font-black tracking-widest uppercase transition-all"
                >
                  CLOSE VAULT
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
