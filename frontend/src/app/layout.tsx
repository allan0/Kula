// FILE: frontend/src/app/layout.tsx
// PURPOSE: Next.js 14 App Router root layout.
// Wraps the entire app in provider stack:
//   Web3Provider (Privy + Wagmi + QueryClient + SmartAccountProvisioner)
//     └─ TelegramProvider (TMA auth + deep-link verification)
//           └─ AuthGate (blocks unauthenticated access)
//                 └─ page content

import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Web3Provider from "@/providers/Web3Provider";
import TelegramProvider from "@/providers/TelegramProvider";
import AuthGate from "@/components/AuthGate";

// ---------------------------------------------------------------------------
// FONTS
// ---------------------------------------------------------------------------

const playfair = Playfair_Display({
  subsets:  ["latin"],
  variable: "--font-serif",
  display:  "swap",
});

const inter = Inter({
  subsets:  ["latin"],
  variable: "--font-sans",
  display:  "swap",
});

// ---------------------------------------------------------------------------
// METADATA
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title:       "KULA | The Sovereign Vault",
  description: "Decentralized ROSCA & Real World Asset protocol on Base L2. Gasless, seedless, built for Africa.",
  keywords:    ["ROSCA", "DeFi", "Base", "Africa", "Chama", "RWA", "Savings"],
  authors:     [{ name: "KULA Protocol" }],
  openGraph: {
    title:       "KULA | The Sovereign Vault",
    description: "Community finance meets on-chain trust. Zero gas. Zero seed phrases.",
    type:        "website",
    url:         "https://kula-six.vercel.app",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card:  "summary_large_image",
    title: "KULA | The Sovereign Vault",
  },
};

export const viewport: Viewport = {
  // TMA requires viewport-fit=cover for proper safe-area handling in Telegram
  themeColor:          "#0F0F0F",
  colorScheme:         "dark",
  width:               "device-width",
  initialScale:        1,
  viewportFit:         "cover",
};

// ---------------------------------------------------------------------------
// ROOT LAYOUT
// ---------------------------------------------------------------------------

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Telegram WebApp SDK — loads async, only activates inside Telegram */}
        <script
          src="https://telegram.org/js/telegram-web-app.js"
          async
        />
      </head>

      <body className="bg-[#0F0F0F] text-white antialiased font-sans min-h-screen">
        <Web3Provider>
          <TelegramProvider>
            <AuthGate>
              {children}
            </AuthGate>
          </TelegramProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
