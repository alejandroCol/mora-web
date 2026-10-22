"use client";

import { useEffect, useState } from "react";
import { BuySheet } from "@/components/product/BuySheet";
import { LookStage } from "@/components/product/LookStage";
import { products, type ModelId } from "@/lib/catalog";
import { track } from "@/growth/track";
import { useMoraStore } from "@/lib/store";

export function ProductExperience({
  modelId,
  description,
}: {
  modelId: ModelId;
  description: string;
}) {
  const { selection, setModel, setFinish } = useMoraStore();
  const model = products[modelId];
  const [copy, setCopy] = useState(description);
  const finishId = model.finishes.includes(selection.finishId)
    ? selection.finishId
    : model.finishes[0];

  useEffect(() => {
    setCopy(description);
  }, [description]);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/gallery?model=${modelId}`)
      .then(async (res) => (await res.json()) as { description?: string })
      .then((data) => {
        if (alive && typeof data.description === "string" && data.description.trim()) {
          setCopy(data.description);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [modelId]);

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
        <section className="relative h-[min(46dvh,32rem)] min-h-[18rem] shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
          <LookStage modelId={modelId} />
        </section>
        <aside className="relative min-h-0 flex-1 bg-white/70 lg:w-[24.5rem] lg:flex-none lg:border-l lg:border-line lg:bg-transparent">
          <BuySheet modelId={modelId} description={copy} />
        </aside>
      </div>
    </div>
  );
}
