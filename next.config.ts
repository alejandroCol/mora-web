import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  transpilePackages: ["three"],
  // Decoder Opus (notas de voz del CRM): solo corre en el navegador; en SSR su
  // shim de Worker para Node trae un import dinámico que Turbopack no resuelve.
  serverExternalPackages: ["ogg-opus-decoder"],
  images: {
    qualities: [75, 100],
  },
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
