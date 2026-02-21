import type { Metadata } from "next";
import "./globals.css";
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
      <body className="antialiased overflow-x-hidden">
        <Providers>
          <SplashLoader />
          <main className="relative z-10">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
