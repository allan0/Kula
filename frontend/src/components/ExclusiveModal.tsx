"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function ExclusiveModal({ isOpen, onClose, title, children }: any) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop: Clicking outside closes the modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-earth-dark/90 backdrop-blur-md cursor-pointer"
          />
          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none p-4"
          >
            <div className="glass-card w-full max-w-2xl max-h-[85vh] overflow-y-auto no-scrollbar rounded-[3rem] p-8 md:p-12 pointer-events-auto relative border border-gold/30">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-serif gold-text tracking-widest uppercase">{title}</h3>
                <button onClick={onClose} className="text-gold/40 hover:text-gold transition-colors">
                  <X size={28} />
                </button>
              </div>
              
              <div className="relative z-10">{children}</div>

              {/* Glowing Gold Close Button at the bottom */}
              <div className="mt-12 flex justify-center">
                <button 
                  onClick={onClose}
                  className="px-10 py-3 rounded-full border border-gold/30 bg-gold/5 text-gold text-[10px] font-black tracking-[0.4em] uppercase hover:bg-gold hover:text-earth-dark transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                >
                  Close Vault
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
