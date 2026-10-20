"use client";

import { BRAND } from "@/brand";
import { SpiralParticles } from "./SpiralParticles";

type BrandLoaderProps = {
  label?: string;
  className?: string;
};

export function BrandLoader({ label, className = "" }: BrandLoaderProps) {
  return (
    <div
      className={`grid place-items-center ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label ?? `Cargando ${BRAND.name}`}
    >
      <SpiralParticles className="h-[4.5rem] w-[4.5rem] sm:h-[5.5rem] sm:w-[5.5rem]" count={7200} />
      <span className="sr-only">{label ?? "Cargando"}</span>
    </div>
  );
}
