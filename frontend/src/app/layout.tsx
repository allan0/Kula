import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import SplashLoader from "@/components/SplashLoader";

export const metadata: Metadata = {
  title: "KULA | Exclusive Rotary Group",
  description: "Digital trust for high-value assets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0F0F0F] selection:bg-[#D4AF37] selection:text-[#0F0F0F]">
        <Providers>
          <SplashLoader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
