'use client';

import React, { useEffect, useState } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';

import '@rainbow-me/rainbowkit/styles.css';

// Fixed WalletConnect ID - Ensure this is registered at cloud.walletconnect.com
// If this still gives 401, you MUST create a new one at WalletConnect cloud.
const PROJECT_ID = '04309ed1007e77d1f11709da9793f9b5'; 

const config = getDefaultConfig({
  appName: 'KULA Exclusive',
  projectId: PROJECT_ID, 
  chains: [baseSepolia],
  transports: { [baseSepolia.id]: http() },
  ssr: true,
});

const queryClient = new QueryClient();

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{children}</>;

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmmasahmx00r80cl5atptvs1u"}
      config={{
        loginMethods: ['email', 'google', 'telegram'],
        appearance: {
          theme: 'dark',
          accentColor: '#D4AF37',
          showWalletLoginFirst: false,
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
          >
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
