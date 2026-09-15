"use client";

import { BrandMarkParticles } from "@/components/brand/BrandMarkParticles";

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
      <BrandMarkParticles
        asset="mark"
        loop
        density={820}
        className="h-36 w-36 sm:h-44 sm:w-44"
      />
    </div>
  );
}
