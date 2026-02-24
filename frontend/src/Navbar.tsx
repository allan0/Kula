"use client";
import { motion } from "framer-motion";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { UserCircle, Fingerprint, Shield } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center backdrop-blur-xl border-b border-gold/10">
      <motion.div 
        initial={{ x: -20, opacity: 0 }} 
        animate={{ x: 0, opacity: 1 }} 
        className="flex items-center gap-3"
      >
        {/* Well Rounded Logo */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gold/20 rounded-full blur-md group-hover:bg-gold/40 transition-all" />
          <img src="/assets/kulalogo.png" alt="K" className="relative w-10 h-10 rounded-full border border-gold/50 object-cover" />
        </div>
        <span className="text-xl font-serif tracking-[0.3em] shimmer-text uppercase hidden md:block">Kula</span>
      </motion.div>

      <div className="flex items-center gap-4">
        {/* High-End Login Button */}
        <button className="flex items-center gap-2 px-4 py-2 text-gold-light/60 hover:text-gold transition-colors group">
          <UserCircle size={20} className="group-hover:rotate-12 transition-transform" />
          <span className="text-[10px] font-bold tracking-widest uppercase">Login</span>
        </button>

        {/* Exclusive Vault Connection */}
        <ConnectButton.Custom>
          {({ account, openConnectModal, mounted }) => (
            <div {...(!mounted && { 'aria-hidden': true, style: { opacity: 0 } })}>
              <button
                onClick={openConnectModal}
                className="flex items-center gap-2 px-5 py-2.5 luxury-border rounded-full shadow-2xl hover:scale-105 transition-all"
              >
                <Fingerprint size={18} className="text-gold" />
                <span className="gold-text text-xs tracking-widest uppercase">
                  {account ? account.displayName : "Open Vault"}
                </span>
              </button>
            </div>
          )}
        </ConnectButton.Custom>
      </div>
    </nav>
  );
}
