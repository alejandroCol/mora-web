import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Solo `next dev`: deja abrir el sitio desde el celular por la IP del Mac en la wifi de casa.
  allowedDevOrigins: ["192.168.*.*"],
  output: "standalone",
  transpilePackages: ["three"],
  // Decoder Opus (notas de voz del CRM): solo corre en el navegador; en SSR su
  // shim de Worker para Node trae un import dinámico que Turbopack no resuelve.
  // ffmpeg-static resuelve su binario con __dirname: empaquetado, apuntaría a otra carpeta.
  serverExternalPackages: ["ogg-opus-decoder", "ffmpeg-static"],
  // El binario no se importa, así que el trazado de standalone no lo copia solo.
  outputFileTracingIncludes: {
    "/api/admin/crm/replies/media/video": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
  images: {
    qualities: [75, 100],
  },
  // Links cortos para escribir en DMs; la marca UTM se agrega aquí.
  async redirects() {
    return [
      {
        source: "/ig",
        destination: "/?utm_source=instagram&utm_medium=dm&utm_campaign=comentario_mora",
        permanent: false,
      },
    ];
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
