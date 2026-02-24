import "./globals.css"; // Make sure there is an 's' at the end
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
      <body className="antialiased overflow-x-hidden bg-[#0F0F0F]">
        <Providers>
          <SplashLoader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
