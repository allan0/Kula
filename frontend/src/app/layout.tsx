import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import SplashLoader from "@/components/SplashLoader";

export const metadata: Metadata = {
  title: "KULA | The Sovereign Vault",
  description: "Exclusive digital trust for high-value assets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Force standards mode */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased bg-[#0F0F0F] text-[#F3E5AB] min-h-screen">
        <Providers>
          <SplashLoader />
          <main className="relative z-0">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
