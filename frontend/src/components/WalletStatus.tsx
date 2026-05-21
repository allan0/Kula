// FILE: frontend/src/components/WalletStatus.tsx
// PURPOSE: Compact wallet status bar displayed in the top-right of the dashboard.
//
// SHOWS:
//   - Smart Account address (shortened, copy-on-click)
//   - USDC balance (live via Wagmi useReadContract)
//   - Wallet source badge (Google / Telegram / Email)
//   - Gas-free indicator
//   - Account status (Pending = not yet deployed, Deployed = active)
//
// LIVE BALANCE: polls every 12s via Wagmi useReadContract connected to
// the USDC contract balanceOf(smartAccountAddress).
//
// SYNC: On every balance update, writes to Zustand so other components
// (AssetVault, Contribute modal) can read without their own contract hooks.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReadContract, useBlockNumber } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import {
  Copy,
  CheckCheck,
  Zap,
  Wallet,
  ExternalLink,
  ChevronDown,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import useKulaStore, {
  selectSmartAccountAddress,
  selectWalletSource,
  selectAccountStatus,
  formatSmartAccountBalance,
  shortenAddress,
} from "@/store/useKulaStore";

// ---------------------------------------------------------------------------
// ABI
// ---------------------------------------------------------------------------

const ERC20_BALANCE_ABI = [
  {
    name:             "balanceOf",
    type:             "function",
    stateMutability:  "view",
    inputs:  [{ name: "account", type: "address" }],
    outputs: [{ name: "",        type: "uint256" }],
  },
] as const;

const USDC_ADDRESS = (
  process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
) as `0x${string}`;

// ---------------------------------------------------------------------------
// SOURCE BADGE LABELS & COLORS
// ---------------------------------------------------------------------------

const SOURCE_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  privy_google:   { label: "Google",   color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
  privy_embedded: { label: "Email",    color: "text-[#D4AF37]",  bg: "bg-[#D4AF37]/10 border-[#D4AF37]/20" },
  telegram:       { label: "Telegram", color: "text-[#229ED9]",  bg: "bg-[#229ED9]/10 border-[#229ED9]/20" },
  ussd:           { label: "USSD",     color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
};

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function WalletStatus() {
  const { logout }           = usePrivy();
  const smartAccountAddress  = useKulaStore(selectSmartAccountAddress);
  const walletSource         = useKulaStore(selectWalletSource);
  const accountStatus        = useKulaStore(selectAccountStatus);
  const setBalance           = useKulaStore(s => s.setSmartAccountBalance);
  const storedBalance        = useKulaStore(s => s.smartAccountBalance);

  const [copied,    setCopied]    = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);

  // ── Live USDC balance ────────────────────────────────────────────────────
  const { data: blockNumber } = useBlockNumber({
    watch:   true,
    chainId: baseSepolia.id,
  });

  const { data: usdcBalance, isLoading: balanceLoading } = useReadContract({
    address:      USDC_ADDRESS,
    abi:          ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args:         smartAccountAddress ? [smartAccountAddress as `0x${string}`] : undefined,
    chainId:      baseSepolia.id,
    query: {
      enabled:         !!smartAccountAddress,
      refetchInterval: 12_000,
    },
  });

  // Sync to global store
  useEffect(() => {
    if (usdcBalance !== undefined && blockNumber !== undefined) {
      setBalance(usdcBalance as bigint, Number(blockNumber));
    }
  }, [usdcBalance, blockNumber, setBalance]);

  // ── Copy address ─────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!smartAccountAddress) return;
    navigator.clipboard.writeText(smartAccountAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!smartAccountAddress) return null;

  const sourceMeta = SOURCE_META[walletSource ?? ""] ?? {
    label: "Vault",
    color: "text-[#D4AF37]",
    bg: "bg-[#D4AF37]/10 border-[#D4AF37]/20",
  };
  const displayBalance = formatSmartAccountBalance(storedBalance as bigint);
  const isDeployed     = accountStatus === "DEPLOYED";

  return (
    <div className="relative">
      {/* ── Main status pill ─────────────────────────────────────────────── */}
      <motion.button
        onClick={() => setMenuOpen(v => !v)}
        className="flex items-center gap-3 px-4 py-2.5 bg-[#1B1212]/80 backdrop-blur-md border border-[#D4AF37]/15 rounded-2xl hover:border-[#D4AF37]/30 transition-all group"
        whileTap={{ scale: 0.97 }}
      >
        {/* Gas-free zap */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-xl">
          <Zap size={10} className="text-green-400 fill-green-400" />
          <span className="text-[9px] font-black uppercase tracking-widest text-green-400">
            Gas Free
          </span>
        </div>

        {/* Balance */}
        <div className="flex items-center gap-1.5">
          {balanceLoading ? (
            <RefreshCw size={12} className="text-[#D4AF37]/50 animate-spin" />
          ) : (
            <span className="text-sm font-bold text-[#D4AF37]">{displayBalance}</span>
          )}
          <span className="text-[10px] text-[#F3E5AB]/50 font-medium">USDC</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-[#D4AF37]/15" />

        {/* Source badge */}
        <div className={`flex items-center gap-1.5 px-2 py-1 border rounded-xl text-[10px] font-bold uppercase tracking-wider ${sourceMeta.bg} ${sourceMeta.color}`}>
          <Wallet size={10} />
          {sourceMeta.label}
        </div>

        {/* Address */}
        <span className="text-xs font-mono text-[#F3E5AB]/50">
          {shortenAddress(smartAccountAddress)}
        </span>

        <ChevronDown
          size={14}
          className={`text-[#D4AF37]/50 transition-transform ${menuOpen ? "rotate-180" : ""}`}
        />
      </motion.button>

      {/* ── Dropdown menu ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,   scale: 1    }}
              exit={{   opacity: 0, y: -8, scale: 0.97   }}
              transition={{ duration: 0.18 }}
              className="absolute top-full right-0 mt-2 z-20 w-80 bg-[#1B1212] border border-[#D4AF37]/20 rounded-[1.75rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#D4AF37]/10">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs uppercase tracking-widest text-[#D4AF37]/60 font-black">
                    Smart Account
                  </p>
                  <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    isDeployed
                      ? "bg-green-500/15 text-green-400 border border-green-500/25"
                      : "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                  }`}>
                    {isDeployed ? "Active" : "Pending"}
                  </div>
                </div>
                <p className="text-sm font-mono text-[#F3E5AB]/70 mt-1 break-all">
                  {smartAccountAddress}
                </p>
              </div>

              {/* Balance section */}
              <div className="p-6 border-b border-[#D4AF37]/10">
                <p className="text-xs uppercase tracking-widest text-[#D4AF37]/60 font-black mb-2">
                  USDC Balance
                </p>
                <p className="text-3xl font-serif text-white">{displayBalance}</p>
                {!isDeployed && (
                  <p className="text-[10px] text-amber-400/70 mt-2">
                    Account deploys automatically on first transaction
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 space-y-1">
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#D4AF37]/5 transition-all text-sm text-[#F3E5AB]/70 font-medium"
                >
                  {copied ? (
                    <CheckCheck size={16} className="text-green-400" />
                  ) : (
                    <Copy size={16} className="text-[#D4AF37]" />
                  )}
                  {copied ? "Address Copied!" : "Copy Address"}
                </button>

                <a
                  href={`https://sepolia.basescan.org/address/${smartAccountAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#D4AF37]/5 transition-all text-sm text-[#F3E5AB]/70 font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  <ExternalLink size={16} className="text-[#D4AF37]" />
                  View on BaseScan
                </a>

                {/* Only show logout for Privy users */}
                {walletSource?.startsWith("privy") && (
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/5 transition-all text-sm text-red-400/70 font-medium"
                  >
                    <LogOut size={16} className="text-red-400" />
                    Sign Out
                  </button>
                )}
              </div>

              {/* Base L2 badge */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-center gap-2 py-3 bg-[#0052FF]/5 border border-[#0052FF]/15 rounded-xl">
                  <div className="w-4 h-4 rounded-full bg-[#0052FF]" />
                  <span className="text-[10px] uppercase tracking-widest text-[#0052FF] font-black">
                    Base Sepolia · EIP-4337
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
