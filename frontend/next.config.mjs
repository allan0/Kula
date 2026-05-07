/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@privy-io/react-auth', '@privy-io/wagmi'],
  images: {
    unoptimized: true,
  },
  // This disables the aggressive icon optimization that is crashing the build
  optimizePackageImports: [] 
};

export default nextConfig;
