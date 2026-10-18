"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const RingCanvas = dynamic(
  () => import("@/components/ring/RingCanvas").then((mod) => mod.RingCanvas),
  {
    ssr: false,
    loading: () => <div className="h-full w-full" aria-hidden />,
  },
);

const DESKTOP_SCALE = 0.756;
/** ~2× el tamaño móvil anterior (0.8× desktop en caja 52vw). */
const MOBILE_SCALE = DESKTOP_SCALE * 1.6;

export function Hero() {
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <section className="hero-wash relative flex min-h-dvh flex-col overflow-hidden">
      {mobile === true ? (
        <div className="relative flex min-h-0 flex-1 items-center justify-center pt-[calc(3.5rem+env(safe-area-inset-top))]">
          <div className="mx-auto h-[min(90vw,36rem)] w-[min(90vw,36rem)] translate-x-[2vw]">
            <RingCanvas
              original
              intro
              scale={MOBILE_SCALE}
              className="h-full w-full"
            />
          </div>
          <a
            href="#coleccion"
            aria-label="Elegir mi Mora"
            className="absolute inset-0 z-[1]"
          />
        </div>
      ) : null}
      {mobile === false ? (
        <div className="absolute inset-0 [&_canvas]:pointer-events-none">
          <RingCanvas
            original
            intro
            scale={DESKTOP_SCALE}
            className="h-full w-full"
          />
          <a
            href="#coleccion"
            aria-label="Elegir mi Mora"
            className="absolute left-1/2 top-[46%] z-[1] block h-[min(70vw,32rem)] w-[min(70vw,32rem)] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
          />
        </div>
      ) : null}
      {mobile === null ? <div className="min-h-0 flex-1" aria-hidden /> : null}

      <div className="pointer-events-none relative z-10 mt-auto flex shrink-0 flex-col items-center px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-2 sm:absolute sm:inset-x-0 sm:bottom-12 sm:pb-0">
        <a
          href="#coleccion"
          aria-label="Elegir mi Mora, preventa"
          className="elegir-cta pointer-events-auto"
        >
          Elegir mi Mora
          <span className="elegir-cta-note">(Preventa)</span>
          <span aria-hidden className="elegir-cta-arrow">
            ›
          </span>
        </a>
      </div>
    </section>
  );
}
