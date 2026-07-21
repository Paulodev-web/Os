import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Upload de assets do portal via Server Action (imagens, PDFs) —
      // múltiplos arquivos por envio desde a galeria por etapa
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
