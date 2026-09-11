"use client";

import dynamic from "next/dynamic";
import { Configurator } from "@/components/configure/Configurator";
import { useMoraStore } from "@/lib/store";

const RingCanvas = dynamic(
  () => import("@/components/ring/RingCanvas").then((mod) => mod.RingCanvas),
  { ssr: false },
);

export function Reserve() {
  const finishId = useMoraStore((state) => state.selection.finishId);

  return (
    <section id="reservar" className="hero-wash border-t border-line">
      <div className="mx-auto grid max-w-6xl items-center gap-3 px-6 pb-0 pt-14 sm:gap-8 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-16">
        <div className="h-[34vh] min-h-[220px] sm:h-[42vh] lg:h-[56vh]">
          <RingCanvas
            configure
            finishId={finishId}
            scale={0.86}
            className="h-full w-full"
          />
        </div>
        <Configurator />
      </div>
    </section>
  );
}
