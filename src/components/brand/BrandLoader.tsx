"use client";

import { BRAND } from "@/brand";
import { BrandMarkParticles } from "./BrandMarkParticles";

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
      <BrandMarkParticles
        asset="mark"
        loop
        density={720}
        className="h-28 w-28 sm:h-32 sm:w-32"
      />
      <span className="sr-only">{label ?? "Cargando"}</span>
    </div>
  );
}
