"use client";

import { useEffect, useLayoutEffect } from "react";
import { BuySheet } from "@/components/product/BuySheet";
import { FeatureRail } from "@/components/product/FeatureRail";
import { LookStage } from "@/components/product/LookStage";
import { ShareProduct } from "@/components/product/ShareProduct";
import { landingFinish, products, writeProductColor, type ModelId } from "@/lib/catalog";
import { track } from "@/growth/track";
import { useInsightProduct } from "@/insights/client";
import { useMoraStore } from "@/lib/store";

export function ProductExperience({
  modelId,
  color = null,
  left = {},
  out = [],
}: {
  modelId: ModelId;
  color?: string | null;
  /** `color:talla` → el aviso, solo si está prendido. */
  left?: Record<string, number>;
  /** `color:talla` sin unidades. */
  out?: string[];
}) {
  const { selection, setModel, setFinish } = useMoraStore();
  const model = products[modelId];
  const opened = landingFinish(modelId, color);
  const finishId = model.finishes.includes(selection.finishId)
    ? selection.finishId
    : opened;

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

  // En celular baja la página entera, foto incluida. El encabezado es transparente sobre la foto:
  // en cuanto la página se mueve toma fondo de cristal para leerse sobre la ficha.
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const read = () => root.toggleAttribute("data-page-scrolled", window.scrollY > 8);
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      root.removeAttribute("data-page-scrolled");
    };
  }, []);

  return (
    <div className="hero-wash product-page min-h-dvh pt-[var(--offer-bar,0px)] transition-[padding] duration-300 lg:h-dvh lg:overflow-hidden">
      <div className="flex flex-col lg:h-full lg:flex-row">
        <section className="relative h-[min(50svh,36rem)] min-h-[20rem] shrink-0 lg:h-auto lg:min-h-0 lg:min-w-0 lg:flex-1">
          <LookStage modelId={modelId} landing={opened} />
          <FeatureRail modelId={modelId} />
          <ShareProduct
            modelId={modelId}
            finishId={finishId}
            name={model.name}
            className="absolute bottom-3 right-3 z-10 sm:bottom-5 sm:right-5"
          />
        </section>
        <aside className="product-sheet relative flex-1 bg-white/70 lg:min-h-0 lg:w-[26rem] lg:flex-none lg:border-l lg:border-line lg:bg-transparent xl:w-[28rem]">
          <BuySheet modelId={modelId} left={left} out={out} />
        </aside>
      </div>
    </div>
  );
}
