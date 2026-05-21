// FILE: frontend/src/providers/Web3Provider.tsx
// PURPOSE: Root Web3 provider stack for KULA.
//
// CHAIN OF RESPONSIBILITY:
//   PrivyProvider
//     └─ WagmiProvider (Base Sepolia)
//           └─ QueryClientProvider
//                 └─ SmartAccountProvisioner   ← auto-creates SA on login
//                       └─ children
//
// PRIVY CONFIG:
//   - loginMethods: google, email, telegram (social-first, no seed phrases)
//   - embeddedWallets.createOnLogin = 'users-without-wallets'
//     → Every Google/email user auto-gets an embedded EOA on first login.
//   - The embedded wallet address becomes the ownerEOA for the EIP-4337
//     Smart Account derived via SimpleAccountFactory on Base Sepolia.
//
// SMART ACCOUNT DERIVATION (client-side, deterministic):
//   salt    = keccak256(ownerEOA + KULA_SALT_SECRET)
//   SA addr = SimpleAccountFactory.getAddress(ownerEOA, salt)  (view call)
//
// GAS:
//   All UserOperations are sponsored via Pimlico paymaster — users never
//   need ETH. The SmartAccountProvisioner only derives the address; actual
//   UserOp submission goes through useSmartAccount.ts hooks.

"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { WagmiProvider, createConfig, http, useReadContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import useKulaStore, { WalletSource } from "@/store/useKulaStore";

// ---------------------------------------------------------------------------
// WAGMI CONFIG — Base Sepolia only
// ---------------------------------------------------------------------------

const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
        "https://sepolia.base.org"
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
      { name: "salt",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const FACTORY_ADDRESS = (
  process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY ||
  "0x9406Cc6185a346906296840746125a0E44976454"  // Canonical v0.6 factory on Base Sepolia
) as `0x${string}`;

// ---------------------------------------------------------------------------
// INNER: SmartAccountProvisioner
// Runs INSIDE both Privy and Wagmi contexts so it can read wallets + call
// the factory contract.
// ---------------------------------------------------------------------------

function SmartAccountProvisioner({ children }: { children: ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets }                    = useWallets();
  const setSmartAccount                = useKulaStore(s => s.setSmartAccount);
  const clearSmartAccount              = useKulaStore(s => s.clearSmartAccount);
  const storedAddress                  = useKulaStore(s => s.smartAccountAddress);
  const walletSource                   = useKulaStore(s => s.walletSource);

  // Identify the embedded wallet EOA Privy created for this user
  const embeddedWallet = wallets.find(
    (w) => w.walletClientType === "privy"
  );
  const ownerEOA = embeddedWallet?.address as `0x${string}` | undefined;

  // Derive salt: keccak256-like deterministic salt from ownerEOA.
  // We keep it simple: use uint256(keccak256(ownerEOA)) truncated to safe range.
  // Must match the backend derivation logic in server.js / telegramBot.js.
  // For Privy users (no phone/TG seed), we use salt = 0 (standard SimpleAccount).
  // You can later extend this to be keyed on Privy DID for extra isolation.
  const PRIVY_SALT = BigInt(0);

  // ── Read counterfactual Smart Account address from factory ──────────────
  const { data: smartAccountAddress } = useReadContract({
    address:      FACTORY_ADDRESS,
    abi:          FACTORY_ABI,
    functionName: "getAddress",
    args:         ownerEOA ? [ownerEOA, PRIVY_SALT] : undefined,
    chainId:      baseSepolia.id,
    query: {
      enabled: !!ownerEOA && authenticated,
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
      const source: WalletSource = user.google
        ? "privy_google"
        : "privy_embedded";

      // Only update if address changed or not yet set
      if (smartAccountAddress !== storedAddress) {
        setSmartAccount(smartAccountAddress, ownerEOA, source, "UNKNOWN");

        // Fire-and-forget: register/sync with backend
        registerWithBackend(ownerEOA, smartAccountAddress, user);
      }
    }
  }, [
    ready,
    authenticated,
    smartAccountAddress,
    ownerEOA,
    storedAddress,
    walletSource,
  ]);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// BACKEND SYNC — registers the Privy embedded wallet with KULA backend
// so the account shows up in USSD and Telegram lookups too.
// ---------------------------------------------------------------------------

async function registerWithBackend(
  ownerEOA:  string,
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
        email:       user?.email?.address ?? null,
        googleEmail: user?.google?.email   ?? null,
        tgId:        user?.telegram?.userId?.toString() ?? null,
        tgUsername:  user?.telegram?.username ?? null,
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
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#D4AF37",
          logo: "/kula-logo.png",
          landingHeader: "Welcome to KULA Vault",
          loginMessage: "Sign in to access your sovereign wealth circle.",
          showWalletLoginFirst: false,
          walletChainType: "ethereum-only",
        },

        // ── Login methods — social-first, zero Web3 jargon ──────────────
        loginMethods: ["google", "email", "telegram"],

        // ── Embedded wallets ─────────────────────────────────────────────
        // createOnLogin: 'users-without-wallets' means every new Google/email
        // user automatically gets a non-custodial embedded wallet created on
        // Privy's secure infrastructure. The user never sees a seed phrase.
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false,
          showWalletUIs: false, // We handle our own wallet UI
          noPromptOnSignature: true, // Silent signing for gasless UX
        },

        // ── Target chain: Base Sepolia ───────────────────────────────────
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],

        // ── Legal ────────────────────────────────────────────────────────
        legal: {
          termsAndConditionsUrl: "https://kula-six.vercel.app/terms",
          privacyPolicyUrl:      "https://kula-six.vercel.app/privacy",
        },

        // ── MFA: disabled by default (simple UX for emerging markets) ───
        mfa: { noPromptOnMfaRequired: false },
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <SmartAccountProvisioner>
            {children}
          </SmartAccountProvisioner>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}

// Re-export wagmiConfig for use in other providers (e.g. TelegramProvider)
export { wagmiConfig, queryClient };
