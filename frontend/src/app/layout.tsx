import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import SplashLoader from "@/components/SplashLoader";

export const metadata: Metadata = {
  title: "KULA | The Sovereign Vault",
  description: "Exclusive digital trust for high-value assets and collective wealth.",
  icons: {
    icon: "/assets/kulalogo.png",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // Good for Telegram Mini Apps
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0F0F0F" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Telegram Mini App specific */}
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className="antialiased bg-[#0F0F0F] text-[#F3E5AB] min-h-screen overflow-x-hidden font-sans">
        <Providers>
          <SplashLoader />
          <main className="relative z-0 min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
