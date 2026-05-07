'use client';

import React, { useMemo } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';

// Import CSS for RainbowKit
import '@rainbow-me/rainbowkit/styles.css';

// Create a stable QueryClient outside the component or via useMemo
const queryClient = new QueryClient();

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  // 1. Setup the RainbowKit/Wagmi Config
  // useMemo ensures this isn't re-created during build/render cycles
  const config = useMemo(() => getDefaultConfig({
    appName: 'KULA Exclusive',
    projectId: '04309ed1007e77d1f11709da9793f9b5', 
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http(),
    },
    ssr: true, // Crucial for Next.js
  }), []);

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmmasahmx00r80cl5atptvs1u"}
      config={{
        loginMethods: ['email', 'google', 'farcaster', 'telegram'],
        appearance: {
          theme: 'dark',
          accentColor: '#D4AF37',
          showWalletLoginFirst: false,
          logo: '/assets/kulalogo.png',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
        },
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider 
            theme={darkTheme({
              accentColor: '#D4AF37', 
              accentColorForeground: '#1B1212',
              borderRadius: 'large',
            })}
            modalSize="compact"
          >
            {/* 
              We wrap children directly here. 
              Components inside will handle their own mounting logic.
            */}
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
