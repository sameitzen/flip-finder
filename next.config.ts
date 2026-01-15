import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase body size limit for server actions (large images)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
