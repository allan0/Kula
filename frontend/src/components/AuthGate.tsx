// FILE: frontend/src/components/AuthGate.tsx
// PURPOSE: Full-screen login gate. Renders when the user is not authenticated.
//
// UX PRINCIPLES:
//   - Zero Web3 jargon: no "wallet", no "seed phrase", no "gas"
//   - Primary CTA: "Continue with Google" (most frictionless for Africa)
//   - Secondary: "Continue via Telegram" (for TMA/bot users)
//   - Tertiary: "Use Email Magic Link"
//   - On success, Web3Provider auto-provisions the embedded wallet + SA
//
// Design: luxury dark (matches existing KULA aesthetic)

"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Send,
  Zap,
  ShieldCheck,
  Coins,
  Globe,
  ArrowRight,
  Loader2,
  Landmark,
} from "lucide-react";

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Feature pill
// ---------------------------------------------------------------------------

function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37]/5 border border-[#D4AF37]/15 rounded-2xl text-xs text-[#F3E5AB]/70 font-medium">
      <span className="text-[#D4AF37]">{icon}</span>
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const { ready, authenticated, login } = usePrivy();
  const [loginLoading, setLoginLoading] = useState<string | null>(null);

  // Show nothing while Privy hydrates
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 size={28} className="text-[#D4AF37]" />
        </motion.div>
      </div>
    );
  }

  // Already authenticated → show the app
  if (authenticated) return <>{children}</>;

  // ── Login handlers ───────────────────────────────────────────────────────
  const handleLogin = async (method: "google" | "email" | "telegram") => {
    setLoginLoading(method);
    try {
      // Privy's login() opens the modal — we pass a pre-selected method
      // by calling the method-specific handlers
      login();
    } catch (err) {
      console.error("Login error:", err);
    } finally {
      // Privy handles its own modal lifecycle; reset our spinner after a delay
      setTimeout(() => setLoginLoading(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] relative overflow-hidden flex items-center justify-center">

      {/* ── Ambient background ───────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-[#D4AF37]/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#B8972E]/5 blur-[100px]" />
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#D4AF37 1px, transparent 1px), linear-gradient(90deg, #D4AF37 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Main card ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Logo area */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-[#D4AF37] to-[#B8972E] mb-6 shadow-[0_0_60px_rgba(212,175,55,0.3)]"
          >
            <Landmark size={36} className="text-black" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl font-serif tracking-tighter text-white mb-2"
          >
            KULA
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-[#F3E5AB]/60 text-sm tracking-wide"
          >
            The Sovereign Wealth Circle
          </motion.p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-[#1B1212]/90 backdrop-blur-xl border border-[#D4AF37]/15 rounded-[2.5rem] p-8 shadow-[0_40px_80px_rgba(0,0,0,0.6)]"
        >
          <p className="text-center text-xs uppercase tracking-[0.35em] text-[#D4AF37] font-black mb-8">
            Sign in to your vault
          </p>

          {/* Primary: Google */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleLogin("google")}
            disabled={!!loginLoading}
            className="w-full flex items-center justify-between px-6 py-5 bg-white hover:bg-[#F0F0F0] text-black rounded-2xl font-bold text-sm transition-all mb-4 shadow-[0_4px_20px_rgba(255,255,255,0.08)] disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              {loginLoading === "google" ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" fill="#4285F4"/>
                  <path d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z" fill="#34A853"/>
                  <path d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z" fill="#FBBC05"/>
                  <path d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" fill="#EA4335"/>
                </svg>
              )}
              <span>Continue with Google</span>
            </div>
            <ArrowRight size={16} />
          </motion.button>

          {/* Secondary: Telegram */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleLogin("telegram")}
            disabled={!!loginLoading}
            className="w-full flex items-center justify-between px-6 py-5 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/30 text-[#229ED9] rounded-2xl font-bold text-sm transition-all mb-3 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              {loginLoading === "telegram" ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
              <span>Continue with Telegram</span>
            </div>
            <ArrowRight size={16} />
          </motion.button>

          {/* Tertiary: Email */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleLogin("email")}
            disabled={!!loginLoading}
            className="w-full flex items-center justify-between px-6 py-5 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              {loginLoading === "email" ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Mail size={20} />
              )}
              <span>Use Email Magic Link</span>
            </div>
            <ArrowRight size={16} />
          </motion.button>

          {/* Gas-free notice */}
          <div className="mt-8 pt-8 border-t border-[#D4AF37]/10">
            <p className="text-center text-[10px] text-[#F3E5AB]/40 uppercase tracking-widest mb-5">
              Everything included, nothing extra
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <FeaturePill icon={<Zap size={12} />}         text="Zero gas fees" />
              <FeaturePill icon={<ShieldCheck size={12} />}  text="No seed phrases" />
              <FeaturePill icon={<Coins size={12} />}        text="Yield on idle funds" />
              <FeaturePill icon={<Globe size={12} />}        text="USSD + Telegram" />
            </div>
          </div>
        </motion.div>

        {/* Bottom disclaimer */}
        <p className="text-center text-[10px] text-[#F3E5AB]/25 mt-6 leading-relaxed px-4">
          By continuing, you agree to KULA&apos;s Terms of Service.
          Your account is non-custodial and secured by Base L2.
        </p>
      </motion.div>
    </div>
  );
}
