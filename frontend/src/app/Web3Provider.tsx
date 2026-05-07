'use client';
import React, { useMemo } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  const config = useMemo(() => getDefaultConfig({
    appName: 'KULA Exclusive',
    projectId: '04309ed1007e77d1f11709da9793f9b5', 
    chains: [baseSepolia],
    transports: { [baseSepolia.id]: http() },
    ssr: true,
  }), []);

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmmasahmx00r80cl5atptvs1u"}
      config={{ loginMethods: ['email', 'google'], appearance: { theme: 'dark', accentColor: '#D4AF37' }}}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={darkTheme({ accentColor: '#D4AF37' })}>
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
