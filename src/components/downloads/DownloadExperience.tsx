"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { APP_STORES, type AppStoreId } from "@/lib/appStores";

type Platform = "iphone" | "ipad" | "android" | "other";

const SHOTS = [
  {
    src: "/descargas/sueno.jpg",
    alt: "Duerme mejor. La app muestra la noche: dormiste 7 horas 17 minutos, con sueño profundo, ligero, REM y despertares.",
  },
  {
    src: "/descargas/pulso.jpg",
    alt: "Entiende tu ritmo. La app muestra el pulso en 71 lpm, con mínimo, media y máximo del día.",
  },
  {
    src: "/descargas/cuerpo.jpg",
    alt: "Conoce tu cuerpo. La app reúne pasos, pulso, recuperación, oxígeno, presión, estrés, piel y noche.",
  },
] as const;

function detectPlatform(): Platform {
  const ua = navigator.userAgent || "";
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPad/.test(ua) || iPadOs) return "ipad";
  if (/iPhone|iPod/.test(ua)) return "iphone";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function storeFor(platform: Platform | null): AppStoreId | null {
  if (platform === "iphone" || platform === "ipad") return "ios";
  if (platform === "android") return "android";
  return null;
}

function AppleMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.45 2.21 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.16-1.69 1.64-3.33 1.66-3.42-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.62-2.32-4.39-2.38-2-.16-3.68 1.09-4.61 1.09zM15.53 3.83c.84-1.01 1.4-2.43 1.25-3.83-1.21.05-2.66.8-3.53 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.72-.69 3.56-1.7z"
      />
    </svg>
  );
}

function PlayMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M3.2 20.4V3.6c0-.55.3-1.05.78-1.3L13.4 12 3.98 21.7c-.48-.25-.78-.75-.78-1.3z"
      />
      <path fill="#34A853" d="M16.55 14.9 14.3 12.7 6.2 20.9c.28.2.64.22.98.08l9.37-6.08z" />
      <path
        fill="#FBBC04"
        d="M19.9 10.9 16.7 9.1l-2.6 2.5 2.55 2.45 3.25-1.85c.62-.36.62-1.18 0-1.5z"
      />
      <path fill="#EA4335" d="M6.2 3.1c.34-.16.74-.14 1.04.06l9.3 5.9-2.25 2.2L6.2 3.1z" />
    </svg>
  );
}

function StoreButtons({ platform }: { platform: Platform | null }) {
  const recommended = storeFor(platform);

  return (
    <div className="flex w-full max-w-xl flex-col gap-3 sm:max-w-none sm:flex-row">
      <StoreLink
        id="ios"
        href={APP_STORES.ios}
        recommended={recommended === "ios"}
        chip={platform === "ipad" ? "Tu iPad" : "Tu iPhone"}
        kicker="App Store"
        title="iPhone"
        note="y iPad"
        label="Descargar Mora Ring para iPhone y iPad en el App Store"
        mark={<AppleMark className="h-8 w-8" />}
      />
      <StoreLink
        id="android"
        href={APP_STORES.android}
        recommended={recommended === "android"}
        chip="Tu Android"
        kicker="Google Play"
        title="Android"
        note=""
        label="Descargar Mora Ring para Android en Google Play"
        mark={<PlayMark className="h-8 w-8" />}
      />
    </div>
  );
}

function StoreLink({
  id,
  href,
  recommended,
  chip,
  kicker,
  title,
  note,
  label,
  mark,
}: {
  id: AppStoreId;
  href: string;
  recommended: boolean;
  chip: string;
  kicker: string;
  title: string;
  note: string;
  label: string;
  mark: ReactNode;
}) {
  return (
    <a
      href={href}
      data-store={id}
      aria-label={recommended ? `${label}. Recomendada para este teléfono` : label}
      className={[
        "group relative flex h-[4.75rem] w-full items-center gap-4 rounded-2xl bg-[#0c0c0e] px-5 text-white sm:w-[17.5rem]",
        "transition-[transform,box-shadow] duration-200",
        "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.985]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6f61b8]",
        recommended
          ? "shadow-[0_0_0_4px_rgba(138,124,214,0.45),0_16px_36px_rgba(70,50,130,0.22)]"
          : "shadow-[0_10px_28px_rgba(20,16,40,0.16)]",
      ].join(" ")}
    >
      {recommended ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium tracking-[-0.01em] text-[#3d3568] shadow-[0_4px_14px_rgba(40,30,80,0.12)]">
          {chip}
        </span>
      ) : null}
      <span className="shrink-0">{mark}</span>
      <span className="min-w-0 text-left leading-none">
        <span className="block text-[12px] font-medium tracking-[-0.01em] text-white/70">
          {kicker}
          {note ? <span className="text-white/55"> · {note}</span> : null}
        </span>
        <span className="mt-1 block text-[1.45rem] font-semibold tracking-[-0.03em]">{title}</span>
      </span>
      <span aria-hidden className="ml-auto text-[1.6rem] font-light leading-none text-white/40">
        ›
      </span>
    </a>
  );
}

export function DownloadExperience() {
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <div className="download-studio relative flex min-h-dvh flex-col text-[#2c2648]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <svg className="absolute -right-[22%] -top-[28%] h-[760px] w-[760px] text-[#ddd6f4]" viewBox="0 0 760 760">
          <circle cx="380" cy="380" r="250" fill="none" stroke="currentColor" strokeWidth="78" />
        </svg>
        <div className="absolute left-1/2 top-[12%] h-72 w-72 -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 pt-[env(safe-area-inset-top)] sm:h-[4.5rem]">
        <Link href="/" aria-label="Mora" className="opacity-90 transition-opacity hover:opacity-60">
          <BrandLogo
            variant="wordmark"
            priority
            className="h-6 w-auto max-w-[6.5rem] object-contain object-left sm:h-7"
          />
        </Link>
        <p className="text-[13px] tracking-[-0.01em] text-[#6a6488]">La app</p>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-5 pb-8 pt-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-10 lg:pb-10 lg:pt-2">
        <div className="frame-in">
          <img
            src="/descargas/icon.png"
            alt="Icono de Mora Ring"
            width={80}
            height={80}
            fetchPriority="high"
            className="h-16 w-16 select-none [filter:drop-shadow(0_16px_24px_rgba(70,50,130,0.28))] sm:h-[5.25rem] sm:w-[5.25rem]"
            draggable={false}
          />
          <p className="kicker mt-6">Mora Ring</p>
          <h1 className="display mt-2 text-[clamp(2.5rem,5.6vw,4.6rem)] text-[#2c2648]">
            Tu bienestar
            <span className="block">en tus manos</span>
          </h1>
          <p className="title-whisper mt-4 max-w-md text-[1.05rem] leading-7 text-[#5e5878] sm:text-[1.2rem]">
            Descarga la app de tu anillo. Elige el teléfono donde vas a usarlo.
          </p>
          <div id="descargar" className="mt-7">
            <StoreButtons platform={platform} />
          </div>
          <p className="mt-4 max-w-md text-[13px] leading-5 text-[#6a6488]">
            Al instalarla, busca este icono. Los dos botones abren la tienda de cada teléfono.
          </p>
        </div>

        <ul className="grid grid-cols-3 items-end gap-2 sm:gap-3 lg:gap-4">
          {SHOTS.map((shot) => (
            <li key={shot.src}>
              <img
                src={shot.src}
                alt={shot.alt}
                width={576}
                height={1024}
                className="aspect-[576/1024] w-full select-none rounded-[1.15rem] object-cover shadow-[0_18px_40px_rgba(80,60,140,0.16)] sm:rounded-[1.35rem]"
                draggable={false}
              />
            </li>
          ))}
        </ul>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center text-[13px] text-[#6a6488]">
        <p>Mora es bienestar. No es un servicio médico.</p>
        <nav aria-label="Legal" className="flex items-center gap-4">
          <Link href="/privacidad" className="text-[#2c2648] underline decoration-[#d9d2ee] underline-offset-4">
            Privacidad
          </Link>
          <Link href="/terminos" className="text-[#2c2648] underline decoration-[#d9d2ee] underline-offset-4">
            Condiciones
          </Link>
        </nav>
      </footer>
    </div>
  );
}
