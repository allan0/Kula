'use client';

import React, { useMemo, useEffect, ReactNode } from 'react';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { WagmiProvider, createConfig, http, useReadContract } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { 
  rainbowWallet, 
  walletConnectWallet, 
  coinbaseWallet 
} from '@rainbow-me/rainbowkit/wallets';
import useKulaStore from '@/store/useKulaStore';

import '@rainbow-me/rainbowkit/styles.css';

// ---------------------------------------------------------------------------
// 1. INFRASTRUCTURE SETUP
// ---------------------------------------------------------------------------

const queryClient = new QueryClient();

const FACTORY_ADDRESS = '0x9406Cc6185a346906296840746125a0E44976454';
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

// ---------------------------------------------------------------------------
// 2. SMART ACCOUNT PROVISIONER
// ---------------------------------------------------------------------------

function SmartAccountProvisioner({ children }: { children: ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const setSmartAccount = useKulaStore(s => s.setSmartAccount);
  const clearSmartAccount = useKulaStore(s => s.clearSmartAccount);
  const storedAddress = useKulaStore(s => s.smartAccountAddress);
  const walletSource = useKulaStore(s => s.walletSource);

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const ownerEOA = embeddedWallet?.address as `0x${string}` | undefined;

  const { data: smartAccountAddress } = useReadContract({
    address: FACTORY_ADDRESS as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: "getAddress",
    args: ownerEOA ? [ownerEOA, BigInt(0)] : undefined,
    query: {
      enabled: !!ownerEOA && authenticated,
    },
  });

  useEffect(() => {
    if (!ready) return;

    if (!authenticated || !user) {
      if (storedAddress && walletSource !== "telegram" && walletSource !== "ussd") {
        clearSmartAccount();
      }
      return;
    }

    if (smartAccountAddress && ownerEOA) {
      const source = user.google ? "privy_google" : "privy_embedded";
      if (smartAccountAddress !== storedAddress) {
        setSmartAccount(smartAccountAddress, ownerEOA, source, "UNKNOWN");

        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/register-privy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
  }, [ready, authenticated, smartAccountAddress, ownerEOA, user, storedAddress, setSmartAccount, clearSmartAccount, walletSource]);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// 3. MAIN WEB3 PROVIDER
// ---------------------------------------------------------------------------

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  
  // Telegram App Config
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0F0F0F');
      tg.setBackgroundColor('#0F0F0F');
    }
  }, []);

  // Create Wagmi Config with RainbowKit Connectors
  const wagmiConfig = useMemo(() => {
    const connectors = connectorsForWallets(
      [
        {
          groupName: 'Recommended',
          wallets: [rainbowWallet, coinbaseWallet, walletConnectWallet],
        },
      ],
      {
        appName: 'KULA Sovereign Vault',
        projectId: '04309ed1007e77d1f11709da9793f9b5',
      }
    );

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
          logo: '/assets/kulalogo.png', // FIXED: No more 404
        },
        externalWallets: {
          telegram: {
            botUsername: 'Kula_chama_bot',
          },
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
          noPromptOnSignature: true,
        },
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider 
            theme={darkTheme({
              accentColor: '#D4AF37',
              accentColorForeground: '#0F0F0F',
              borderRadius: 'large',
            })}
            modalSize="compact"
          >
            {/* 
              CRITICAL: SmartAccountProvisioner must be inside 
              RainbowKitProvider because it uses Wagmi hooks 
              that RainbowKit configures.
            */}
            <SmartAccountProvisioner>
              {children}
            </SmartAccountProvisioner>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}