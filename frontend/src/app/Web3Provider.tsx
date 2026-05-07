'use client';

import React, { useEffect, useState } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';

// Import CSS for RainbowKit
import '@rainbow-me/rainbowkit/styles.css';

// 1. Create a SINGLETON config outside the component to prevent re-initialization crashes
const config = getDefaultConfig({
  appName: 'KULA Exclusive',
  // Note: Your Project ID 04309ed1007e77d1f11709da9793f9b5 is returning 401. 
  // Ensure this is created at cloud.walletconnect.com
  projectId: '04309ed1007e77d1f11709da9793f9b5', 
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Return a fragment during server-side rendering to maintain tree structure
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
