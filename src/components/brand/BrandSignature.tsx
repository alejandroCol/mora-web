"use client";

import { BRAND } from "@/brand";
import { BrandMarkParticles } from "./BrandMarkParticles";

export function BrandSignature({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <BrandMarkParticles
        asset="wordmark"
        density={1600}
        className="h-12 w-[min(18rem,82vw)] sm:h-14 sm:w-[22rem]"
        aria-label={BRAND.name}
      />
    </div>
  );
}
