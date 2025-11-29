import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack config for Next.js 16+
  turbopack: {
    resolveAlias: {
      // xterm.js works fine with Turbopack, no special config needed
    },
  },
  // Keep webpack config as fallback for compatibility
  webpack: (config, { isServer }) => {
    // Fix for xterm.js and addons in Next.js
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
