"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Configurator } from "@/components/configure/Configurator";
import { ParticleVeil } from "@/components/gallery/ParticleVeil";
import { useMoraStore } from "@/lib/store";

const RingCanvas = dynamic(
  () => import("@/components/ring/RingCanvas").then((mod) => mod.RingCanvas),
  { ssr: false },
);

export function Reserve() {
  const router = useRouter();
  const selection = useMoraStore((state) => state.selection);
  const closeCart = useMoraStore((state) => state.closeCart);
  const [leaving, setLeaving] = useState(false);

  function openGallery() {
    closeCart();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      router.push(`/galeria/${selection.modelId}?entrada=1`);
      return;
    }
    setLeaving(true);
    window.setTimeout(() => {
      router.push(`/galeria/${selection.modelId}?entrada=1`);
    }, 720);
  }

  return (
    <section id="reservar" className="hero-wash border-t border-line">
      <div className="mx-auto grid max-w-6xl items-center gap-3 px-6 pb-0 pt-14 sm:gap-8 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-16">
        <div className="relative h-[34vh] min-h-[220px] sm:h-[42vh] lg:h-[56vh]">
          <RingCanvas
            configure
            finishId={selection.finishId}
            scale={0.86}
            className="h-full w-full"
          />
          <button
            type="button"
            onClick={openGallery}
            className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 text-[12px] tracking-[0.06em] text-soft transition-colors hover:text-ink sm:bottom-3"
          >
            Ver imágenes
          </button>
        </div>
        <Configurator />
      </div>
      {leaving ? <ParticleVeil /> : null}
    </section>
  );
}
