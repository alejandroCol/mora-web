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
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div className="h-[42vh] min-h-[280px] lg:h-[58vh]">
          <RingCanvas
            configure
            finishId={finishId}
            scale={0.9}
            className="h-full w-full"
          />
        </div>
        <Configurator />
      </div>
    </section>
  );
}
