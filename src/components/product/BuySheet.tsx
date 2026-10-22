"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  finishLabel,
  formatMoney,
  products,
  resolveFinish,
  type ModelId,
} from "@/lib/catalog";
import { track } from "@/growth/track";
import { useSales } from "@/components/sales/SalesProvider";
import { insightProductCart } from "@/insights/client";
import { useMoraStore } from "@/lib/store";
import { AddiWidget } from "@/components/payments/AddiWidget";
import { SizeChoice } from "./SizeChoice";

export function BuySheet({
  modelId,
  description,
}: {
  modelId: ModelId;
  description: string;
}) {
  const router = useRouter();
  const sales = useSales();
  const { selection, setFinish, setSize, setSizing, addSelectionToCart, closeCart } =
    useMoraStore();
  const model = products[modelId];
  const finishId = model.finishes.includes(selection.finishId)
    ? selection.finishId
    : model.finishes[0];
  const sizing = selection.sizing;
  const [need, setNeed] = useState("");
  const [showCopy, setShowCopy] = useState(false);

  function add() {
    if (!sizing) {
      setNeed("Elige si quieres pedir un medidor.");
      return;
    }
    if (sizing === "self" && !model.sizes.includes(selection.size)) {
      setNeed(sales.needSize);
      return;
    }
    setNeed("");
    addSelectionToCart(1);
    closeCart();
    track("AddToCart", {
      content_ids: [model.id],
      content_name: `Mora ${model.name} ${finishLabel(modelId, finishId)}`,
      content_type: "product",
      value: model.price,
      currency: "COP",
      num_items: 1,
    });
    insightProductCart(model.id, model.name);
    router.push("/checkout");
  }

  const hint =
    need ||
    (sizing === "kit"
      ? sales.kitHint
      : sizing === "self"
        ? sales.deliveryHint
        : "");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 hide-scroll sm:px-8 sm:pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="title-name text-[2.35rem] text-[#1d1d1f] sm:text-[2.85rem]">
              {model.name}
            </h1>
            <p className="text-[11px] tracking-[-0.01em] text-soft sm:text-[12px]">{model.line}</p>
          </div>
          <p className="text-[17px] tracking-[-0.02em] text-[#1d1d1f]">
            {formatMoney(model.price)}
          </p>
        </div>
        <AddiWidget price={model.price} className="mt-2" />

        <fieldset className="mt-4 sm:mt-7">
          <legend className="text-[12px] text-soft">Color</legend>
          <div className="mt-3 flex gap-2">
            {model.finishes.map((id) => {
              const item = resolveFinish(modelId, id);
              const on = id === finishId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFinish(id)}
                  aria-pressed={on}
                  aria-label={finishLabel(modelId, id)}
                  className="finish-pick"
                >
                  <span
                    className={`finish-swatch ${on ? "finish-swatch-on" : ""}`}
                    style={{ background: item.swatch }}
                  />
                  <span className="finish-label">
                    {finishLabel(modelId, id)}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {model.kind === "ring" ? (
          <div className="mt-4 sm:mt-6">
            <SizeChoice
              sizing={sizing}
              onSizing={(method) => {
                setNeed("");
                setSizing(method);
              }}
              sizes={model.sizes}
              size={selection.size}
              onSize={(size) => {
                setNeed("");
                setSize(size);
              }}
            />
          </div>
        ) : null}

        {description ? (
          <div className="mt-4 sm:mt-5">
            {showCopy ? (
              <p className="max-w-[36ch] text-[14px] leading-5 text-soft sm:text-[15px] sm:leading-6">
                {description}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setShowCopy((value) => !value)}
              className="mt-0.5 text-[13px] tracking-[-0.018em] text-[#6e6e73] transition-colors hover:text-[#1d1d1f]"
            >
              {showCopy ? "Cerrar descripción" : "Ver toda la descripción"}
              <span aria-hidden className="ml-0.5">
                {showCopy ? "‹" : "›"}
              </span>
            </button>
          </div>
        ) : null}

      </div>

      <div className="shrink-0 border-t border-line bg-white/80 px-5 py-3 backdrop-blur-xl pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        <button
          type="button"
          onClick={add}
          className="flex h-11 w-full items-center justify-center rounded-full bg-[#1d1d1f] text-[17px] tracking-[-0.022em] text-white transition-colors hover:bg-[#3a3a3c]"
        >
          {sales.cta} {model.name}
        </button>
        {hint ? (
          <p className="mt-2 text-center text-[11px] leading-4 text-soft">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
