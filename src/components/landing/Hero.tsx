"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const RingCanvas = dynamic(
  () => import("@/components/ring/RingCanvas").then((mod) => mod.RingCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center">
        <p className="mark text-xl text-ink/25">Mora</p>
      </div>
    ),
  },
);

const DESKTOP_SCALE = 0.756;
const MOBILE_SCALE = DESKTOP_SCALE * 0.8;

export function Hero() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <section className="hero-wash relative flex min-h-dvh flex-col overflow-hidden">
      {mobile ? (
        <div className="relative flex min-h-0 flex-1 items-center justify-center pt-[calc(3.5rem+env(safe-area-inset-top))]">
          <div className="mx-auto h-[min(52vw,22rem)] w-[min(52vw,22rem)] translate-x-[2vw]">
            <RingCanvas
              original
              intro
              scale={MOBILE_SCALE}
              className="h-full w-full"
            />
          </div>
          <a
            href="#reservar"
            aria-label="Elegir color"
            className="absolute inset-0 z-[1]"
          />
        </div>
      ) : (
        <div className="absolute inset-0 [&_canvas]:pointer-events-none">
          <RingCanvas
            original
            intro
            scale={DESKTOP_SCALE}
            className="h-full w-full"
          />
          <a
            href="#reservar"
            aria-label="Elegir color"
            className="absolute left-1/2 top-[46%] z-[1] block h-[min(70vw,32rem)] w-[min(70vw,32rem)] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
          />
        </div>
      )}

      <div className="pointer-events-none relative z-10 mt-auto flex shrink-0 flex-col items-center gap-3 px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-2 sm:absolute sm:inset-x-0 sm:bottom-12 sm:gap-5 sm:pb-0">
        <p className="title-whisper text-[clamp(1.45rem,7vw,2.75rem)] leading-[1.15] text-ink">
          Un anillo.
          <span className="text-ink/55"> Un estado.</span>
        </p>
        <a
          href="#coleccion"
          className="pointer-events-auto text-[13px] text-soft transition-colors hover:text-ink"
        >
          Seguir
        </a>
      </div>
    </section>
  );
}
