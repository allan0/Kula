// FILE: frontend/src/providers/TelegramProvider.tsx
// PURPOSE: Handles Telegram Mini App (TMA) authentication.
//
// AUTH FLOW:
//   1. User taps "Open App" inside Telegram → bot generates a signed deep-link:
//      https://kula-six.vercel.app/?tgAuth=<base64url(payload)>.<hmac-sha256>
//   2. This provider reads the tgAuth param, calls the backend to verify the
//      HMAC signature (secret stays server-side), and receives the Smart Account
//      address that was deterministically derived from the Telegram ID.
//   3. The verified identity is synced to Zustand, giving the rest of the app
//      a seamless gasless experience identical to the Privy flow.
//
// TELEGRAM WEB APP SDK:
//   In true TMA context (launched FROM Telegram), we also initialise
//   Telegram.WebApp to get native UX affordances (haptics, back button, etc).
//   We detect TMA by checking window.Telegram.WebApp.initData.
//
// SECURITY:
//   - HMAC verification happens on the backend via POST /api/verify-tg-auth
//   - Deep-link tokens expire after 10 minutes (enforced by backend `ts` check)
//   - On TMA: initData is also validated server-side for belt-and-suspenders

"use client";

import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import useKulaStore from "@/store/useKulaStore";

// ---------------------------------------------------------------------------
// TELEGRAM WEBAPP TYPES
// (Minimal subset — install @types/telegram-web-app for full types)
// ---------------------------------------------------------------------------

interface TelegramWebApp {
  initData:       string;
  initDataUnsafe: {
    user?: {
      id:         number;
      first_name: string;
      last_name?:  string;
      username?:   string;
    };
    start_param?: string;
  };
  ready:          () => void;
  expand:         () => void;
  close:          () => void;
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
  BackButton: {
    show:    () => void;
    hide:    () => void;
    onClick: (fn: () => void) => void;
  };
  MainButton: {
    text:      string;
    color:     string;
    textColor: string;
    isVisible: boolean;
    isActive:  boolean;
    show:      () => void;
    hide:      () => void;
    enable:    () => void;
    disable:   () => void;
    onClick:   (fn: () => void) => void;
    offClick:  (fn: () => void) => void;
    showProgress:  (leaveActive?: boolean) => void;
    hideProgress:  () => void;
    setText:   (text: string) => void;
    setParams:  (params: object) => void;
  };
  colorScheme:  "light" | "dark";
  themeParams:  Record<string, string>;
  viewportHeight:      number;
  viewportStableHeight: number;
  isExpanded:   boolean;
  platform:     string;
  version:      string;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

// ---------------------------------------------------------------------------
// CONTEXT
// ---------------------------------------------------------------------------

interface TelegramContextValue {
  isTma:       boolean;
  tgUser:      { id: string; username: string; displayName: string } | null;
  tgWebApp:    TelegramWebApp | null;
  authStatus:  "idle" | "verifying" | "verified" | "failed";
  authError:   string | null;
  triggerHaptic: (style?: "light" | "medium" | "heavy") => void;
}

const TelegramContext = createContext<TelegramContextValue>({
  isTma:        false,
  tgUser:       null,
  tgWebApp:     null,
  authStatus:   "idle",
  authError:    null,
  triggerHaptic: () => {},
});

export const useTelegramContext = () => useContext(TelegramContext);

// ---------------------------------------------------------------------------
// PROVIDER
// ---------------------------------------------------------------------------

export default function TelegramProvider({ children }: { children: ReactNode }) {
  const [isTma,      setIsTma]      = useState(false);
  const [tgUser,     setTgUser]     = useState<TelegramContextValue["tgUser"]>(null);
  const [tgWebApp,   setTgWebApp]   = useState<TelegramWebApp | null>(null);
  const [authStatus, setAuthStatus] = useState<TelegramContextValue["authStatus"]>("idle");
  const [authError,  setAuthError]  = useState<string | null>(null);

  const storeSetSmartAccount  = useKulaStore(s => s.setSmartAccount);
  const storeSetTelegramUser  = useKulaStore(s => s.setTelegramUser);
  const storeSetIsTma         = useKulaStore(s => s.setIsTma);
  const storedSmartAccount    = useKulaStore(s => s.smartAccountAddress);
  const storedWalletSource    = useKulaStore(s => s.walletSource);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

  // ── Haptic utility ────────────────────────────────────────────────────────
  const triggerHaptic = useCallback(
    (style: "light" | "medium" | "heavy" = "light") => {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
      } catch {}
    },
    []
  );

  // ── Verify a tgAuth deep-link token via backend ─────────────────────────
  const verifyDeepLink = useCallback(
    async (tgAuth: string) => {
      setAuthStatus("verifying");
      setAuthError(null);

      try {
        const res  = await fetch(`${backendUrl}/api/verify-tg-auth`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ tgAuth }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error ?? "TG auth verification failed");
        }

        // data = { tgId, tgUsername, displayName, smartAccountAddress, ownerEOA, accountStatus }
        const { tgId, tgUsername, displayName, smartAccountAddress, ownerEOA, accountStatus } = data;

        setTgUser({ id: tgId, username: tgUsername ?? "", displayName: displayName ?? tgUsername ?? tgId });
        storeSetTelegramUser({ tgId, tgUsername: tgUsername ?? "", displayName: displayName ?? "" });
        storeSetSmartAccount(smartAccountAddress, ownerEOA, "telegram", accountStatus ?? "UNKNOWN");
        setAuthStatus("verified");

        // Remove tgAuth from URL bar (clean up)
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("tgAuth");
          window.history.replaceState({}, "", url.toString());
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setAuthError(msg);
        setAuthStatus("failed");
        console.error("[TelegramProvider] deep-link verification failed:", msg);
      }
    },
    [backendUrl, storeSetSmartAccount, storeSetTelegramUser]
  );

  // ── Verify native TMA initData via backend ─────────────────────────────
  const verifyInitData = useCallback(
    async (webapp: TelegramWebApp) => {
      if (!webapp.initData) return;

      setAuthStatus("verifying");
      setAuthError(null);

      try {
        const res  = await fetch(`${backendUrl}/api/verify-tg-initdata`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ initData: webapp.initData }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error ?? "TMA initData verification failed");
        }

        const { tgId, tgUsername, displayName, smartAccountAddress, ownerEOA, accountStatus } = data;

        setTgUser({ id: tgId, username: tgUsername ?? "", displayName: displayName ?? tgUsername ?? tgId });
        storeSetTelegramUser({ tgId, tgUsername: tgUsername ?? "", displayName: displayName ?? "" });
        storeSetSmartAccount(smartAccountAddress, ownerEOA, "telegram", accountStatus ?? "UNKNOWN");
        setAuthStatus("verified");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setAuthError(msg);
        setAuthStatus("failed");
        console.error("[TelegramProvider] initData verification failed:", msg);
      }
    },
    [backendUrl, storeSetSmartAccount, storeSetTelegramUser]
  );

  // ── Bootstrap on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const webapp = window.Telegram?.WebApp;

    // ── Case 1: Native Telegram Mini App ──────────────────────────────────
    if (webapp?.initData) {
      webapp.ready();
      webapp.expand();
      setIsTma(true);
      storeSetIsTma(true);
      setTgWebApp(webapp);

      const tgUserRaw = webapp.initDataUnsafe?.user;
      if (tgUserRaw) {
        const displayName = [tgUserRaw.first_name, tgUserRaw.last_name]
          .filter(Boolean)
          .join(" ");
        setTgUser({
          id:          String(tgUserRaw.id),
          username:    tgUserRaw.username ?? "",
          displayName: displayName || String(tgUserRaw.id),
        });
      }

      // Don't overwrite an already-verified Telegram session in the store
      if (storedWalletSource !== "telegram") {
        verifyInitData(webapp);
      } else {
        setAuthStatus("verified");
      }

      return;
    }

    // ── Case 2: Deep-link from Telegram bot (?tgAuth=...) ────────────────
    const params  = new URLSearchParams(window.location.search);
    const tgAuth  = params.get("tgAuth");

    if (tgAuth) {
      setIsTma(false);
      storeSetIsTma(false);
      verifyDeepLink(tgAuth);
      return;
    }

    // ── Case 3: Returning session already stored ─────────────────────────
    if (storedWalletSource === "telegram" && storedSmartAccount) {
      setAuthStatus("verified");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ^ intentionally empty: this should run exactly once on mount

  const value: TelegramContextValue = {
    isTma,
    tgUser,
    tgWebApp,
    authStatus,
    authError,
    triggerHaptic,
  };

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}
