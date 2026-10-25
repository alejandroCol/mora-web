"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { BuySheet } from "@/components/product/BuySheet";
import { LookStage } from "@/components/product/LookStage";
import { ShareProduct } from "@/components/product/ShareProduct";
import { landingFinish, products, writeProductColor, type ModelId } from "@/lib/catalog";
import { track } from "@/growth/track";
import { useInsightProduct } from "@/insights/client";
import { useMoraStore } from "@/lib/store";

export function ProductExperience({
  modelId,
  description,
  color = null,
}: {
  modelId: ModelId;
  description: string;
  color?: string | null;
}) {
  const { selection, setModel, setFinish } = useMoraStore();
  const model = products[modelId];
  const [copy, setCopy] = useState(description);
  const opened = landingFinish(modelId, color);
  const finishId = model.finishes.includes(selection.finishId)
    ? selection.finishId
    : opened;

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

  useLayoutEffect(() => {
    const finish = landingFinish(modelId, color);
    if (useMoraStore.getState().selection.modelId !== modelId) setModel(modelId);
    setFinish(finish);
    writeProductColor(modelId, finish);
  }, [color, modelId, setFinish, setModel]);

  useInsightProduct(model.id, model.name);

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
    <div className="hero-wash h-dvh overflow-hidden">
      <div className="flex h-full flex-col lg:flex-row">
        <section className="relative h-[min(50dvh,36rem)] min-h-[20rem] shrink-0 lg:h-auto lg:min-h-0 lg:min-w-0 lg:flex-1">
          <LookStage modelId={modelId} landing={opened} />
          <ShareProduct
            modelId={modelId}
            finishId={finishId}
            name={model.name}
            className="absolute bottom-3 right-3 z-10 sm:bottom-5 sm:right-5"
          />
        </section>
        <aside className="product-sheet relative min-h-0 flex-1 bg-white/70 lg:w-[26rem] lg:flex-none lg:border-l lg:border-line lg:bg-transparent xl:w-[28rem]">
          <BuySheet modelId={modelId} description={copy} />
        </aside>
      </div>
    </div>
  );
}
