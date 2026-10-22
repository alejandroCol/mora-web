"use client";

import { useEffect } from "react";
import { BuySheet } from "@/components/product/BuySheet";
import { LookStage } from "@/components/product/LookStage";
import { products, type ModelId } from "@/lib/catalog";
import { track } from "@/growth/track";
import { useMoraStore } from "@/lib/store";

export function ProductExperience({ modelId }: { modelId: ModelId }) {
  const { selection, setModel, setFinish } = useMoraStore();
  const model = products[modelId];
  const finishId = model.finishes.includes(selection.finishId)
    ? selection.finishId
    : model.finishes[0];

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
    <div className="hero-wash product-stage h-dvh overflow-hidden">
      <div className="mx-auto flex h-full max-w-[1180px] flex-col lg:flex-row">
        <section className="relative h-[min(54dvh,36rem)] min-h-[22rem] shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
          <LookStage modelId={modelId} />
        </section>
        <aside className="relative min-h-0 flex-1 bg-white/70 lg:w-[24.5rem] lg:flex-none lg:border-l lg:border-line lg:bg-transparent">
          <BuySheet modelId={modelId} />
        </aside>
      </div>
    </div>
  );
}
