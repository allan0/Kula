"use client";
import { motion } from "framer-motion";
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 px-8 py-6 flex justify-between items-center backdrop-blur-md border-b border-gold/10">
      <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-2">
        <img src="/assets/kulalogo.png" alt="KULA" className="w-12 h-12" />
        <span className="text-2xl font-serif tracking-widest gold-text uppercase">Kula</span>
      </motion.div>

      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, mounted }) => {
            return (
              <div
                {...(!mounted && {
                  'aria-hidden': true,
                  'style': { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
                })}
              >
                <button
                  onClick={openConnectModal}
                  className="px-6 py-2 bg-gradient-to-r from-gold-dark to-gold rounded-full text-earth-dark font-bold tracking-tighter shadow-lg hover:scale-105 transition-transform"
                >
                  {account ? account.displayName : "ENTER VAULT"}
                </button>
              </div>
            );
          }}
        </ConnectButton.Custom>
      </motion.div>
    </nav>
  );
}
