"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BuySheet } from "@/components/product/BuySheet";
import { LookStage } from "@/components/product/LookStage";
import { products, type ModelId } from "@/lib/catalog";
import { track } from "@/growth/track";
import { useMoraStore } from "@/lib/store";

const RingCanvas = dynamic(
  () => import("@/components/ring/RingCanvas").then((mod) => mod.RingCanvas),
  { ssr: false },
);

export function ProductExperience({ modelId }: { modelId: ModelId }) {
  const { selection, setModel, setFinish } = useMoraStore();
  const model = products[modelId];
  const [desktop, setDesktop] = useState(false);
  const [looks, setLooks] = useState(false);
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

  return (
    <div
      className={`hero-wash product-stage h-dvh overflow-hidden ${
        looks ? "product-stage-looks" : ""
      }`}
    >
      <div className="mx-auto flex h-full max-w-[1180px] flex-col lg:flex-row">
        <section
          className={`relative shrink-0 lg:h-auto lg:min-h-0 lg:flex-1 ${
            looks
              ? "h-[min(64dvh,40rem)] min-h-[22rem]"
              : "flex h-[28vh] min-h-[168px] items-center justify-center"
          }`}
        >
          {looks ? (
            <LookStage modelId={modelId} onBack={() => setLooks(false)} />
          ) : (
            <>
              <RingCanvas
                configure
                finishId={finishId}
                scale={desktop ? 0.58 : 0.7}
                className="h-full w-full max-w-[34rem]"
              />
              <button
                type="button"
                onClick={() => setLooks(true)}
                className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 text-[13px] tracking-[-0.01em] text-soft transition-colors hover:text-ink lg:bottom-6"
              >
                Ver imágenes ›
              </button>
            </>
          )}
        </section>
        <aside className="relative min-h-0 flex-1 bg-white/70 lg:w-[24.5rem] lg:flex-none lg:border-l lg:border-line lg:bg-transparent">
          <BuySheet
            modelId={modelId}
            onGallery={looks ? undefined : () => setLooks(true)}
          />
        </aside>
      </div>
    </div>
  );
}
