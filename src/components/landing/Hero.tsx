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
      <div className="absolute inset-0">
        <RingCanvas original intro scale={0.756} className="h-full w-full" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-12 z-10 flex flex-col items-center gap-5 px-6">
        <p className="title-whisper text-[clamp(1.85rem,3.6vw,2.75rem)] leading-[1.15] text-ink">
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
