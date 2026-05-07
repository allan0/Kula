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
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0F0F0F] text-[#F3E5AB] selection:bg-[#D4AF37] selection:text-[#0F0F0F] min-h-screen overflow-x-hidden">
        <Providers>
          <SplashLoader />
          <div className="relative z-0">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
