"use client";

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

export function Hero() {
  return (
    <section className="hero-wash relative min-h-dvh overflow-hidden">
      <div className="absolute inset-0 [&_canvas]:pointer-events-none">
        <RingCanvas
          original
          intro
          scale={0.756}
          className="h-full w-full origin-center scale-80 sm:scale-100"
        />
        <a
          href="#reservar"
          aria-label="Elegir color"
          className="absolute left-1/2 top-[46%] z-[1] block h-[min(56vw,25.6rem)] w-[min(56vw,25.6rem)] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full sm:h-[min(70vw,32rem)] sm:w-[min(70vw,32rem)]"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[max(1.75rem,env(safe-area-inset-bottom))] z-10 flex flex-col items-center gap-3 px-6 sm:bottom-12 sm:gap-5">
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
