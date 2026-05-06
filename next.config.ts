import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  experimental: {
    preloadEntriesOnStart: false,
    serverComponentsHmrCache: false,
    turbopackFileSystemCacheForDev: false,
    webpackMemoryOptimizations: true,
  },
  onDemandEntries: {
    maxInactiveAge: 10 * 1000,
    pagesBufferLength: 1,
  },
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;
