"use client";

import dynamic from 'next/dynamic';

// Dynamically import the client component to disable SSR (important for wallet providers and animations)
const DashboardClient = dynamic(() => import('./DashboardClient'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
        <p className="text-[#D4AF37] text-sm tracking-widest font-mono">LOADING VAULT...</p>
      </div>
    </div>
  )
});

export default function DashboardPage() {
  return <DashboardClient />;
}
