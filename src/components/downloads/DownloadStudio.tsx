import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function DownloadStudio({ children }: { children: ReactNode }) {
  return (
    <div className="download-studio relative flex min-h-dvh flex-col text-[#2c2648]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <svg className="absolute -right-[22%] -top-[28%] h-[760px] w-[760px] text-[#ddd6f4]" viewBox="0 0 760 760">
          <circle cx="380" cy="380" r="250" fill="none" stroke="currentColor" strokeWidth="78" />
        </svg>
        <div className="absolute left-1/2 top-[12%] h-72 w-72 -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-center px-5 pt-[env(safe-area-inset-top)] sm:h-[4.5rem]">
        <Link href="/" aria-label="Mora" className="opacity-90 transition-opacity hover:opacity-60">
          <BrandLogo
            variant="wordmark"
            priority
            className="h-6 w-auto max-w-[6.5rem] object-contain object-left sm:h-7"
          />
        </Link>
      </header>

      {children}

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
