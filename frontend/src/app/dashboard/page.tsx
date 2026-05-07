"use client";

import dynamic from 'next/dynamic';

// This disables Server-Side Rendering (SSR) for the entire Dashboard
const DashboardClient = dynamic(() => import('./DashboardClient'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
      <div className="w-10 h-10 border-t-2 border-[#D4AF37] rounded-full animate-spin" />
    </div>
  )
});

export default function DashboardPage() {
  return <DashboardClient />;
}
