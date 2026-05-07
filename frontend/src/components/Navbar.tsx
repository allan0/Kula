"use client";

import { motion } from "framer-motion";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { UserCircle, Fingerprint, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { useAccount } from 'wagmi';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isConnected, address } = useAccount();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0F0F0F]/95 backdrop-blur-2xl border-b border-[#D4AF37]/10 px-5 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        
        {/* Logo Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/30 to-transparent rounded-full blur-xl group-hover:blur-2xl transition-all" />
            <img 
              src="/assets/kulalogo.png" 
              alt="KULA" 
              className="relative w-11 h-11 rounded-full border border-[#D4AF37]/40 object-cover" 
            />
          </div>
          <div>
            <span className="font-serif text-2xl tracking-[0.08em] shimmer-text">KULA</span>
            <p className="text-[10px] text-[#D4AF37]/60 -mt-1 tracking-widest">SOVEREIGN VAULT</p>
          </div>
        </motion.div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#vault" className="text-sm uppercase tracking-widest hover:text-[#D4AF37] transition-colors">The Vault</a>
          <a href="#assets" className="text-sm uppercase tracking-widest hover:text-[#D4AF37] transition-colors">Assets</a>
          <a href="#governance" className="text-sm uppercase tracking-widest hover:text-[#D4AF37] transition-colors">Governance</a>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-4">
          {/* Status Indicator */}
          {isConnected && (
            <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-[#1B1212] border border-[#D4AF37]/20 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-mono text-[#D4AF37]/80">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
          )}

          {/* Connect Button */}
          <ConnectButton.Custom>
            {({ account, openConnectModal, mounted }) => {
              const ready = mounted;
              return (
                <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0 } })}>
                  {account ? (
                    <button
                      onClick={() => {/* Add disconnect logic if needed */}}
                      className="flex items-center gap-3 px-6 py-3 bg-[#1B1212] border border-[#D4AF37]/30 hover:border-[#D4AF37] rounded-2xl transition-all"
                    >
                      <Fingerprint size={18} className="text-[#D4AF37]" />
                      <span className="text-sm font-medium text-[#F3E5AB] hidden md:block">
                        {account.displayName}
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={openConnectModal}
                      className="btn-gold flex items-center gap-3 px-7 py-3 rounded-2xl text-sm font-black tracking-widest"
                    >
                      <Fingerprint size={18} />
                      OPEN VAULT
                    </button>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-3 text-[#D4AF37]"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="md:hidden border-t border-[#D4AF37]/10 mt-4 pt-6 bg-[#0F0F0F]"
        >
          <div className="flex flex-col gap-6 px-6 pb-8 text-lg">
            <a href="#vault" className="hover:text-[#D4AF37]">The Vault</a>
            <a href="#assets" className="hover:text-[#D4AF37]">Asset Vault</a>
            <a href="#governance" className="hover:text-[#D4AF37]">Governance</a>
            <a href="#roadmap" className="hover:text-[#D4AF37]">Roadmap</a>
          </div>
        </motion.div>
      )}
    </nav>
  );
}
