'use client';

import React, { useMemo, useEffect, ReactNode } from 'react';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
// IMPORTANT — verified by reading @privy-io/wagmi@4.0.2's actual source:
//
// 1. @privy-io/wagmi's `WagmiProvider` wraps wagmi's own WagmiProvider and nests an
//    internal <PrivyWagmiConnector>, which uses a `useSyncPrivyWallets` effect to push
//    the embedded wallet connector directly into the live wagmi Config's internal state
//    at runtime (via `config._internal.connectors.setState(...)`). It does this
//    regardless of what's in the `connectors` array you passed to createConfig — so it
//    is fully compatible with a config built any other way, including plain wagmi's
//    createConfig with RainbowKit's connectorsForWallets.
//
// 2. @privy-io/wagmi's `createConfig`, however, is NOT a drop-in: its source is
//    `wagmiCreateConfig({ ssr: true, ...args, connectors: args.connectors?.filter(c =>
//    c.type === "mock") })` — i.e. it silently DROPS every connector you pass in unless
//    its type is "mock". Using it with RainbowKit's connectors (as an earlier version of
//    this file did) results in an EMPTY connector list, which is what caused
//    "Detected injected providers: []" and the embedded-wallet proxy error to persist.
//
// Fix: use plain wagmi's `createConfig` (as in the original file) so RainbowKit's
// connectors survive, and ONLY swap `WagmiProvider` for @privy-io/wagmi's version, since
// that's the piece that actually wires in the Privy embedded wallet at runtime.
import { createConfig, http, useReadContract } from 'wagmi';
import { WagmiProvider } from '@privy-io/wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
} from '@rainbow-me/rainbowkit/wallets';
import useKulaStore from '@/store/useKulaStore';

import '@rainbow-me/rainbowkit/styles.css';

// Minimal ambient typing for Telegram's WebApp bridge so `window.Telegram.WebApp` is
// type-safe here without pulling in a full @types package. Extend as you use more of the
// WebApp API elsewhere in the app.
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
      };
    };
  }
}

// 1. Setup Query Client
const queryClient = new QueryClient();

// 2. Constants for Smart Account
//
// TODO(verify-before-deploy): This address is a PLACEHOLDER. The original value
// ('0x9406Cc6185a346906296840746125a0E44976454') is INVALID — it has 41 hex characters
// after '0x' instead of the required 40 (20 bytes). Passing a malformed address into
// useReadContract's `address` field can throw during render, which is the most likely
// root cause of the "Transaction hooks must be used within RainbowKitProvider" error you
// saw, since a synchronous throw inside a hook can corrupt the provider tree below it.
//
// Replace this with your verified, deployed Factory contract address (40 hex chars after
// 0x) before shipping. Until then, FACTORY_READY below is forced to false so the
// useReadContract call is disabled instead of crashing on a bad address.
const FACTORY_ADDRESS = '0x0000000000000000000000000000000000dEaD' as const;
const FACTORY_READY = false; // flip to true once FACTORY_ADDRESS is the real, verified address

const FACTORY_ABI = [
  {
    name: 'getAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// ---------------------------------------------------------------------------
// SMART ACCOUNT PROVISIONER
// ---------------------------------------------------------------------------
function SmartAccountProvisioner({ children }: { children: ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const setSmartAccount = useKulaStore((s) => s.setSmartAccount);
  const clearSmartAccount = useKulaStore((s) => s.clearSmartAccount);
  const storedAddress = useKulaStore((s) => s.smartAccountAddress);
  const walletSource = useKulaStore((s) => s.walletSource);

  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
  const ownerEOA = embeddedWallet?.address as `0x${string}` | undefined;

  const { data: smartAccountAddress } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: 'getAddress',
    args: ownerEOA ? [ownerEOA, BigInt(0)] : undefined,
    query: { enabled: FACTORY_READY && !!ownerEOA && authenticated },
  });

  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !user) {
      if (storedAddress && walletSource !== 'telegram' && walletSource !== 'ussd') {
        clearSmartAccount();
      }
      return;
    }

    if (smartAccountAddress && ownerEOA) {
      const source = user.google ? 'privy_google' : 'privy_embedded';
      if (smartAccountAddress !== storedAddress) {
        setSmartAccount(smartAccountAddress, ownerEOA, source, 'UNKNOWN');
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/register-privy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerEOA,
            smartAccountAddress,
            privyUserId: user.id,
            email: user.email?.address ?? null,
            googleEmail: user.google?.email ?? null,
            tgId: user.telegram?.telegramUserId ?? null,
            tgUsername: user.telegram?.username ?? null,
          }),
        }).catch(() => {});
      }
    }
  }, [
    ready,
    authenticated,
    smartAccountAddress,
    ownerEOA,
    user,
    storedAddress,
    setSmartAccount,
    clearSmartAccount,
    walletSource,
  ]);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// MAIN WEB3 PROVIDER
// ---------------------------------------------------------------------------
export default function Web3Provider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0F0F0F');
      tg.setBackgroundColor('#0F0F0F');
    }
  }, []);

  // Build RainbowKit connectors for EXTERNAL wallets only (MetaMask/Coinbase/Rainbow/WalletConnect).
  // Privy's embedded wallet is NOT listed here — it's injected at runtime into this
  // config's live state by @privy-io/wagmi's WagmiProvider (see render below), not by
  // anything passed into createConfig.
  const wagmiConfig = useMemo(() => {
    const connectors = connectorsForWallets(
      [
        {
          groupName: 'External Wallets',
          wallets: [rainbowWallet, coinbaseWallet, walletConnectWallet],
        },
      ],
      {
        appName: 'KULA Sovereign Vault',
        projectId: '04309ed1007e77d1f11709da9793f9b5',
      }
    );

    // This is plain wagmi's createConfig (NOT @privy-io/wagmi's) so the RainbowKit
    // connectors above are kept as-is. @privy-io/wagmi's WagmiProvider (rendered below)
    // injects the Privy embedded wallet into this config's live state at runtime — it
    // doesn't need or use this connectors array to do so.
    return createConfig({
      connectors,
      chains: [baseSepolia],
      transports: {
        [baseSepolia.id]: http(),
      },
      ssr: true,
    });
  }, []);

  return (
    <PrivyProvider
      appId="cmmasahmx00r80cl5atptvs1u"
      config={{
        loginMethods: ['email', 'google', 'telegram', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#D4AF37',
          showWalletLoginFirst: false,
          logo: '/assets/kulalogo.png',
        },
        // NOTE: externalWallets.telegram.botUsername (used in the original file) does not
        // exist in @privy-io/react-auth@3.14.1 — Telegram bot config for login now lives
        // entirely in the Privy Dashboard (App settings → Telegram), not in client code.
        // 'telegram' in loginMethods above is still correct and sufficient; just make sure
        // the bot username is set in the Dashboard to match @Kula_chama_bot.
        embeddedWallets: {
          // NOTE: in 3.14.1 this nests under `ethereum` (and/or `solana`) instead of being
          // flat — the original file's flat `createOnLogin`/`requireUserPasswordOnCreate`/
          // `noPromptOnSignature` keys don't exist on this version's config type and were
          // silently ignored by Privy at runtime (TypeScript would have caught this if the
          // file had been type-checked against the installed package).
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
          // showWalletUIs: false is the closest equivalent to the old `noPromptOnSignature`
          // — it suppresses Privy's own wallet UI/prompts. There is no longer a
          // `requireUserPasswordOnCreate` option in this SDK version; password-on-create
          // behavior for embedded wallets is now controlled from the Privy Dashboard.
          showWalletUIs: false,
        },
        // Required so Privy's embedded wallet connector targets the same chain(s) your
        // wagmi config uses. Without this, Privy and wagmi can disagree about which chain
        // the embedded wallet should be provisioned on.
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
      }}
    >
      {/* WagmiProvider here is @privy-io/wagmi's version — it must wrap children INSIDE
          PrivyProvider (Privy needs to be ready first) and OUTSIDE RainbowKitProvider
          (RainbowKit needs an existing wagmi config/context to read from). */}
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: '#D4AF37',
              accentColorForeground: '#0F0F0F',
              borderRadius: 'large',
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
