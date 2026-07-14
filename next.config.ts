import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Upload de assets do portal via Server Action (imagens, PDFs)
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
