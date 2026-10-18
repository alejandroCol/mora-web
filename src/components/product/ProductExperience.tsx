"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ParticleVeil } from "@/components/gallery/ParticleVeil";
import { BuySheet } from "@/components/product/BuySheet";
import { products, type ModelId } from "@/lib/catalog";
import { track } from "@/growth/track";
import { useMoraStore } from "@/lib/store";

const RingCanvas = dynamic(
  () => import("@/components/ring/RingCanvas").then((mod) => mod.RingCanvas),
  { ssr: false },
);

export function ProductExperience({ modelId }: { modelId: ModelId }) {
  const router = useRouter();
  const { selection, setModel, setFinish, closeCart } = useMoraStore();
  const model = products[modelId];
  const [leaving, setLeaving] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const finishId = model.finishes.includes(selection.finishId)
    ? selection.finishId
    : model.finishes[0];

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (selection.modelId !== modelId) setModel(modelId);
    else if (selection.finishId !== finishId) setFinish(finishId);
  }, [finishId, modelId, selection.finishId, selection.modelId, setFinish, setModel]);

  useEffect(() => {
    track("ViewContent", {
      content_ids: [model.id],
      content_name: `Mora ${model.name}`,
      content_type: "product",
      content_category: model.line,
      value: model.price,
      currency: "COP",
    });
  }, [model.id, model.line, model.name, model.price]);

  function openGallery() {
    closeCart();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      router.push(`/galeria/${modelId}?entrada=1`);
      return;
    }
    setLeaving(true);
    window.setTimeout(() => {
      router.push(`/galeria/${modelId}?entrada=1`);
    }, 720);
  }

  return (
    <div className="hero-wash h-dvh overflow-hidden pt-[calc(3.5rem+env(safe-area-inset-top))] sm:pt-[4.25rem]">
      <div className="mx-auto flex h-full max-w-[1180px] flex-col lg:flex-row">
        <section className="relative flex h-[28vh] min-h-[168px] shrink-0 items-center justify-center lg:h-auto lg:min-h-0 lg:flex-1">
          <RingCanvas
            configure
            finishId={finishId}
            scale={desktop ? 0.58 : 0.7}
            className="h-full w-full max-w-[34rem]"
          />
          <button
            type="button"
            onClick={openGallery}
            className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-[13px] tracking-[-0.01em] text-soft transition-colors hover:text-ink lg:bottom-6"
          >
            Ver imágenes ›
          </button>
        </section>
        <aside className="relative min-h-0 flex-1 bg-white/70 lg:w-[24.5rem] lg:flex-none lg:border-l lg:border-line lg:bg-transparent">
          <BuySheet modelId={modelId} onGallery={openGallery} />
        </aside>
      </div>
      {leaving ? <ParticleVeil /> : null}
    </div>
  );
}
