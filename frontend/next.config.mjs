/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This tells Next.js to compile Privy's code to avoid icon errors
  transpilePackages: ['@privy-io/react-auth'],
  images: {
    unoptimized: true,
  },
  // Disabling barrel optimization for icons to prevent build-time crashes
  optimizePackageImports: ['lucide-react'],
};

export default nextConfig;
