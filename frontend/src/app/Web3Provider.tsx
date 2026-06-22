'use client';

import React, { useMemo, useEffect, ReactNode } from 'react';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
// IMPORTANT: createConfig and WagmiProvider come from @privy-io/wagmi, NOT from 'wagmi'.
// @privy-io/wagmi's versions of these wrap wagmi's own createConfig/WagmiProvider and
// automatically register Privy's embedded-wallet connector into the resulting config.
// Importing these from plain 'wagmi' (as the previous version of this file did) is why
// Privy logged "Wallet proxy not initialized" and wagmi detected zero injected providers
// — the embedded wallet connector was never actually wired into the wagmi config.
import { createConfig, WagmiProvider } from '@privy-io/wagmi';
import { http, useReadContract } from 'wagmi';
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
            tgId: user.telegram?.userId?.toString() ?? null,
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
  // Privy's embedded-wallet connector is added automatically by @privy-io/wagmi's createConfig
  // below — it does NOT need to (and should not) be listed here manually.
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

    // createConfig here is @privy-io/wagmi's version: it takes the same shape as wagmi's
    // createConfig, but merges in Privy's own embedded-wallet connector alongside whatever
    // connectors you pass, so external wallets (RainbowKit) and the Privy embedded wallet
    // both end up registered in the same wagmi config.
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
        externalWallets: {
          telegram: { botUsername: 'Kula_chama_bot' },
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
          noPromptOnSignature: true,
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
