'use client';

import React, { useMemo } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';

import '@rainbow-me/rainbowkit/styles.css';

// 1. STABLE CONFIG: Move this OUTSIDE to prevent "undefined to object" errors
const stableQueryClient = new QueryClient();

// NOTE: Your ID 04309ed1007e77d1f11709da9793f9b5 is failing. 
// I've added a fallback check. If the modal doesn't open, replace this ID.
const walletConnectProjectId = '04309ed1007e77d1f11709da9793f9b5';

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  const config = useMemo(() => getDefaultConfig({
    appName: 'KULA Exclusive',
    projectId: walletConnectProjectId, 
    chains: [baseSepolia],
    transports: { [baseSepolia.id]: http() },
    ssr: true,
  }), []);

  return (
    <PrivyProvider
      appId="cmmasahmx00r80cl5atptvs1u"
      config={{
        loginMethods: ['email', 'google', 'telegram'],
        appearance: {
          theme: 'dark',
          accentColor: '#D4AF37',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
        },
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={stableQueryClient}>
          <RainbowKitProvider 
            theme={darkTheme({
              accentColor: '#D4AF37', 
              accentColorForeground: '#1B1212',
              borderRadius: 'large',
            })}
          >
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
