'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the Web3Provider with SSR disabled
const Web3Provider = dynamic(() => import('./Web3Provider'), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-[#1B1212]" />,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Web3Provider>
      {children}
    </Web3Provider>
  );
}
