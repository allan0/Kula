'use client';

import React, { useEffect, useState } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';

// Import CSS for RainbowKit
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Setup the RainbowKit/Wagmi Config
  const config = getDefaultConfig({
    appName: 'KULA Exclusive',
    // Restored standard WalletConnect ID (Your Privy ID goes in the Provider below, not here)
    projectId: '04309ed1007e77d1f11709da9793f9b5', 
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http(),
    },
    ssr: true,
  });

  // Prevent SSR crashes during Next.js compilation
  if (!mounted) return null;

  return (
    <PrivyProvider
      // CORRECTED: Your Privy App ID is now in the right place
      appId="cmmasahmx00r80cl5atptvs1u" 
      config={{
        loginMethods: ['email', 'google', 'facebook', 'linkedin', 'telegram'],
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
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
