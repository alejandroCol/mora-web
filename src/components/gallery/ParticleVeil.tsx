"use client";

import { SpiralParticles } from "@/components/brand/SpiralParticles";

type ParticleVeilProps = {
  leaving?: boolean;
};

export function ParticleVeil({ leaving = false }: ParticleVeilProps) {
  return (
    <div
      className={`gallery-veil pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-[#f4f3f8] ${
        leaving ? "gallery-veil-leave" : ""
      }`}
      aria-hidden
    >
      <SpiralParticles className="h-20 w-20 sm:h-[6.5rem] sm:w-[6.5rem]" count={8400} />
    </div>
  );
}
