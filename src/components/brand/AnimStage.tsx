"use client";

import { SpiralParticles } from "./SpiralParticles";

export function AnimStage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#fbfbfd]">
      <SpiralParticles className="h-[min(29vmin,14.5rem)] w-[min(29vmin,14.5rem)]" count={10200} />
    </div>
  );
}
