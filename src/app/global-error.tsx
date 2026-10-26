"use client";

import { BRAND } from "@/brand";
import "./globals.css";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es-CO">
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <title>Algo no cargó bien — Mora</title>
        <main className="hero-wash flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.assets.wordmark} alt={BRAND.name} className="h-7 w-auto" />
          <h1 className="display mt-8 text-[clamp(2rem,6vw,3rem)] leading-[1.06]">
            Algo no cargó bien.
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-7 text-soft">
            Recarga la página. Si sigue igual, escríbenos.
          </p>
          <button type="button" onClick={() => retry()} className="elegir-cta mt-8">
            Recargar
          </button>
          <div className="mt-5 flex gap-5 text-[14px]">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- replaces the root layout */}
            <a href="/" className="text-ink/70">
              Ir al inicio
            </a>
            <a href={BRAND.contact.whatsapp} className="text-ink/70">
              WhatsApp
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
