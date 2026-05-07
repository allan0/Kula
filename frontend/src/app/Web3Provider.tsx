'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';

// Import CSS for RainbowKit
import '@rainbow-me/rainbowkit/styles.css';

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use useMemo to ensure config is stable and doesn't trigger re-renders
  const config = useMemo(() => getDefaultConfig({
    appName: 'KULA Exclusive',
    projectId: '04309ed1007e77d1f11709da9793f9b5', // Ensure this is a valid WalletConnect ID
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http(),
    },
    ssr: true,
  }), []);

  const queryClient = useMemo(() => new QueryClient(), []);

  // Prevent hydration UI mismatch
  if (!mounted) return <div style={{ visibility: 'hidden' }}>{children}</div>;

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmmasahmx00r80cl5atptvs1u"}
      config={{
        loginMethods: ['email', 'google', 'farcaster', 'telegram'],
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
