/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Smaller bundles: only include lucide icons that are used
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;

