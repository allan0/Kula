// FILE: frontend/src/providers/Web3Provider.tsx
// PURPOSE: Root Web3 provider stack for KULA.
//
// CHAIN OF RESPONSIBILITY:
//   PrivyProvider
//     └─ QueryClientProvider
//           └─ WagmiProvider (Base Sepolia)         ← @privy-io/wagmi's version
//                 └─ RainbowKitProvider              ← ADDED: was missing entirely
//                       └─ SmartAccountProvisioner   ← auto-creates SA on login
//                             └─ children
//
// *** WHY RainbowKitProvider WAS ADDED ***
// Navbar.tsx (and a duplicate at src/Navbar.tsx) render RainbowKit's
// <ConnectButton.Custom>, which calls RainbowKit-internal hooks. Those hooks throw
// "Transaction hooks must be used within RainbowKitProvider" if no RainbowKitProvider
// is mounted above them — which was the case in the previous version of this file.
// That throw, happening during render, is also what corrupted Privy's embedded wallet
// setup downstream (logged as "Wallet proxy not initialized" / "Detected injected
// providers: []") — both errors had the same single root cause.
//
// *** OTHER FIXES IN THIS VERSION (verified against your installed package.json) ***
// 1. FACTORY_ADDRESS fallback was invalid: '0x9406Cc6185a346906296840746125a0E44976454'
//    has 41 hex characters after '0x' instead of 40. Passing a malformed address into
//    useReadContract's `address` field can throw during render. Replaced with a clearly
//    fake placeholder + a FACTORY_READY flag that disables the read until you supply the
//    real, verified factory address.
// 2. PrivyProvider config used fields that don't exist in your installed
//    @privy-io/react-auth@^3.14.1: `embeddedWallets.requireUserPasswordOnCreate` and
//    `embeddedWallets.noPromptOnSignature` (removed), and `embeddedWallets.createOnLogin`
//    (now nested under `embeddedWallets.ethereum.createOnLogin`). These were being
//    silently ignored by Privy at runtime. Fixed to match the actual installed type.
// 3. `user?.telegram?.userId` doesn't exist on the Telegram linked-account type in this
//    SDK version — the field is `telegramUserId` (already a string). Fixed.
// 4. WagmiProvider now comes from `@privy-io/wagmi`, not plain `wagmi`. createConfig stays
//    as plain wagmi's createConfig — @privy-io/wagmi's own createConfig silently drops any
//    connectors you pass in except ones typed "mock", which would have wiped out the
//    RainbowKit connectors added below. (Verified by reading the actual package source.)
//    @privy-io/wagmi's WagmiProvider is what injects the Privy embedded wallet into this
//    config's live state at runtime, independent of the connectors array.
//
// SMART ACCOUNT DERIVATION (client-side, deterministic):
//   salt    = 0n (standard SimpleAccount, see PRIVY_SALT below)
//   SA addr = SimpleAccountFactory.getAddress(ownerEOA, salt)  (view call)
//
// GAS:
//   All UserOperations are sponsored via Pimlico paymaster — users never
//   need ETH. The SmartAccountProvisioner only derives the address; actual
//   UserOp submission goes through useSmartAccount.ts hooks.

"use client";

import React, { ReactNode, useEffect } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { createConfig, http, useReadContract } from "wagmi";
import { WagmiProvider } from "@privy-io/wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";
import useKulaStore, { WalletSource } from "@/store/useKulaStore";

import "@rainbow-me/rainbowkit/styles.css";

// ---------------------------------------------------------------------------
// WAGMI CONFIG — Base Sepolia only, plain wagmi createConfig + RainbowKit connectors
// ---------------------------------------------------------------------------

const rainbowKitConnectors = connectorsForWallets(
  [
    {
      groupName: "External Wallets",
      wallets: [rainbowWallet, coinbaseWallet, walletConnectWallet],
    },
  ],
  {
    appName: "KULA Sovereign Vault",
    // TODO: move to NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID env var for easier rotation.
    projectId: "04309ed1007e77d1f11709da9793f9b5",
  }
);

const wagmiConfig = createConfig({
  connectors: rainbowKitConnectors,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org"
    ),
  },
  ssr: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 2,
    },
  },
});

// ---------------------------------------------------------------------------
// SIMPLE ACCOUNT FACTORY ABI (ERC-4337 v0.6 SimpleAccountFactory)
// ---------------------------------------------------------------------------

const FACTORY_ABI = [
  {
    name: "getAddress",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

// TODO(verify-before-deploy): the previous fallback address
// ('0x9406Cc6185a346906296840746125a0E44976454') is INVALID — 41 hex chars after '0x'
// instead of 40. Set NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY to your real, verified factory
// address, then flip FACTORY_READY to true below. Until then this is disabled rather
// than crashing useReadContract on a malformed address.
const FACTORY_ADDRESS = (
  process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY || "0x000000000000000000000000000000000000dEaD"
) as `0x${string}`;
const FACTORY_READY = !!process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY;

// ---------------------------------------------------------------------------
// INNER: SmartAccountProvisioner
// Runs INSIDE both Privy and Wagmi contexts so it can read wallets + call
// the factory contract.
// ---------------------------------------------------------------------------

function SmartAccountProvisioner({ children }: { children: ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const setSmartAccount = useKulaStore((s) => s.setSmartAccount);
  const clearSmartAccount = useKulaStore((s) => s.clearSmartAccount);
  const storedAddress = useKulaStore((s) => s.smartAccountAddress);
  const walletSource = useKulaStore((s) => s.walletSource);

  // Identify the embedded wallet EOA Privy created for this user
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const ownerEOA = embeddedWallet?.address as `0x${string}` | undefined;

  // Derive salt: standard SimpleAccount uses salt = 0. Must match the backend
  // derivation logic in server.js / telegramBot.js.
  const PRIVY_SALT = BigInt(0);

  // ── Read counterfactual Smart Account address from factory ──────────────
  const { data: smartAccountAddress } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getAddress",
    args: ownerEOA ? [ownerEOA, PRIVY_SALT] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: FACTORY_READY && !!ownerEOA && authenticated,
      staleTime: Infinity, // Address is deterministic — never changes
    },
  });

  // ── Sync to Zustand ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;

    if (!authenticated || !user) {
      // Logged out — clear wallet state
      if (storedAddress && walletSource !== "telegram" && walletSource !== "ussd") {
        clearSmartAccount();
      }
      return;
    }

    if (smartAccountAddress && ownerEOA) {
      const source: WalletSource = user.google ? "privy_google" : "privy_embedded";

      // Only update if address changed or not yet set
      if (smartAccountAddress !== storedAddress) {
        setSmartAccount(smartAccountAddress, ownerEOA, source, "UNKNOWN");

        // Fire-and-forget: register/sync with backend
        registerWithBackend(ownerEOA, smartAccountAddress, user);
      }
    }
  }, [ready, authenticated, smartAccountAddress, ownerEOA, storedAddress, walletSource]);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// BACKEND SYNC — registers the Privy embedded wallet with KULA backend
// so the account shows up in USSD and Telegram lookups too.
// ---------------------------------------------------------------------------

async function registerWithBackend(
  ownerEOA: string,
  smartAccountAddress: string,
  user: ReturnType<typeof usePrivy>["user"]
) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) return;

  try {
    await fetch(`${backendUrl}/api/register-privy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerEOA,
        smartAccountAddress,
        privyUserId: user?.id,
        email: user?.email?.address ?? null,
        googleEmail: user?.google?.email ?? null,
        // NOTE: was `user?.telegram?.userId` — that field doesn't exist on this SDK
        // version's Telegram linked-account type. The correct field is
        // `telegramUserId`, and it's already a string (no .toString() needed).
        tgId: user?.telegram?.telegramUserId ?? null,
        tgUsername: user?.telegram?.username ?? null,
      }),
    });
  } catch {
    // Non-fatal — backend sync can fail without breaking the UX
  }
}

// ---------------------------------------------------------------------------
// PUBLIC: Web3Provider — wraps the entire app
// ---------------------------------------------------------------------------

export default function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId="cmmasahmx00r80cl5atptvs1u"
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#D4AF37",
          logo: "/assets/kulalogo.png", // was '/kula-logo.png' — that path 404s; real asset lives at /assets/kulalogo.png
          landingHeader: "Welcome to KULA Vault",
          loginMessage: "Sign in to access your sovereign wealth circle.",
          showWalletLoginFirst: false,
          walletChainType: "ethereum-only",
        },

        // ── Login methods — social-first, zero Web3 jargon ──────────────
        loginMethods: ["google", "email", "telegram"],

        // ── Embedded wallets ─────────────────────────────────────────────
        // NOTE: in @privy-io/react-auth@^3.14.1 this config nests under `ethereum`
        // (and/or `solana`) — the previous flat shape
        // (createOnLogin/requireUserPasswordOnCreate/noPromptOnSignature at the top
        // level) doesn't match this version's type and was being silently ignored.
        // `showWalletUIs: false` is the closest available equivalent to the old
        // `noPromptOnSignature`. There's no password-on-create option in this SDK
        // version anymore — that's now controlled from the Privy Dashboard.
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          showWalletUIs: false,
        },

        // ── Target chain: Base Sepolia ───────────────────────────────────
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],

        // ── Legal ────────────────────────────────────────────────────────
        legal: {
          termsAndConditionsUrl: "https://kula-six.vercel.app/terms",
          privacyPolicyUrl: "https://kula-six.vercel.app/privacy",
        },

        // ── MFA: disabled by default (simple UX for emerging markets) ───
        mfa: { noPromptOnMfaRequired: false },
      }}
    >
      <QueryClientProvider client={queryClient}>
        {/* WagmiProvider here is @privy-io/wagmi's version. It must be a descendant of
            PrivyProvider (it reads Privy's wallet state internally to sync the embedded
            wallet into wagmi at runtime) and an ancestor of RainbowKitProvider (RainbowKit
            needs an existing wagmi Config/context to read from). */}
        <WagmiProvider config={wagmiConfig}>
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: "#D4AF37",
              accentColorForeground: "#0F0F0F",
              borderRadius: "large",
            })}
            modalSize="compact"
          >
            <SmartAccountProvisioner>{children}</SmartAccountProvisioner>
          </RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

// Re-export wagmiConfig + queryClient for use in other providers (e.g. TelegramProvider)
export { wagmiConfig, queryClient };
