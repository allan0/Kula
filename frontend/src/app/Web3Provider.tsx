'use client';

import React, { useMemo, useEffect } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';

import '@rainbow-me/rainbowkit/styles.css';

// Stable Query Client
const stableQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

const walletConnectProjectId = '04309ed1007e77d1f11709da9793f9b5'; // Replace if needed

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  
  // Telegram Mini App Initialization
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0F0F0F');
      tg.setBackgroundColor('#0F0F0F');
      
      // Enable back button if needed
      // tg.BackButton.show();
      
      console.log("✅ Telegram WebApp initialized");
    }
  }, []);

  const config = useMemo(() => getDefaultConfig({
    appName: 'KULA Sovereign Vault',
    projectId: walletConnectProjectId,
    chains: [baseSepolia],
    transports: { 
      [baseSepolia.id]: http() 
    },
    ssr: true,
  }), []);

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
              accentColorForeground: '#0F0F0F',
              borderRadius: 'large',
              fontStack: 'system',
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
