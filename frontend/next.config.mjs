/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We remove 'output: export' so Vercel can handle the dynamic dashboard logic
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
