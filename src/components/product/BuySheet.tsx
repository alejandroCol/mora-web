"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  finishLabel,
  formatMoney,
  products,
  resolveFinish,
  writeProductColor,
  type ModelId,
} from "@/lib/catalog";
import { track } from "@/growth/track";
import { useSales } from "@/components/sales/SalesProvider";
import { insightProductCart } from "@/insights/client";
import { useMoraStore } from "@/lib/store";
import { AddiCuotasButton } from "@/components/payments/AddiCuotasButton";
import { AddiWidget } from "@/components/payments/AddiWidget";
import { addiAmountAllowed, checkoutHref } from "@/payments/public";
import { loadPayMethods } from "@/payments/methodsClient";
import { ProductSpecSheet } from "./ProductSpecSheet";
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
  const {
    selection,
    setFinish,
    setSize,
    setSizing,
    addSelectionToCart,
    closeCart,
    openCart,
  } = useMoraStore();
  const model = products[modelId];
  const finishId = model.finishes.includes(selection.finishId)
    ? selection.finishId
    : model.finishes[0];
  const sizing = selection.sizing;
  const [need, setNeed] = useState("");
  const [showCopy, setShowCopy] = useState(false);
  const [addiRange, setAddiRange] = useState<{ minCop: number; maxCop: number } | null>(null);
  const specRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void loadPayMethods().then((methods) => {
      if (!alive) return;
      setAddiRange(methods.addi ? { minCop: methods.minCop, maxCop: methods.maxCop } : null);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!showCopy || !specRef.current) return;
    const node = specRef.current;
    const scroller = node.closest(".overflow-y-auto");
    if (!(scroller instanceof HTMLElement)) return;
    const delta = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + delta - 12), behavior: "smooth" });
  }, [showCopy]);

  function validateSelection() {
    if ((sizing ?? "self") === "self" && !model.sizes.includes(selection.size)) {
      setNeed(sales.needSize);
      return false;
    }
    setNeed("");
    return true;
  }

  function trackAdd() {
    track("AddToCart", {
      content_ids: [model.id],
      content_name: `Mora ${model.name} ${finishLabel(modelId, finishId)}`,
      content_type: "product",
      value: model.price,
      currency: "COP",
      num_items: 1,
    });
    insightProductCart(model.id, model.name);
  }

  function addToCart() {
    if (!validateSelection()) return;
    addSelectionToCart(1);
    trackAdd();
    openCart();
  }

  function buyNow(pay?: "addi") {
    if (!validateSelection()) return;
    addSelectionToCart(1);
    closeCart();
    trackAdd();
    router.push(checkoutHref(pay));
  }

  const offerAddi =
    addiRange != null &&
    (model.kind === "ring" ||
      addiAmountAllowed(model.price, addiRange.minCop, addiRange.maxCop));

  const hint = need || (sizing === "self" ? sales.deliveryHint : "");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-12 pt-3 hide-scroll sm:px-8 sm:pb-14 sm:pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="title-name text-[2.35rem] text-[#1d1d1f] sm:text-[2.85rem]">
              {model.name}
            </h1>
            <p className="text-[11px] tracking-[-0.01em] text-soft sm:text-[12px]">{model.line}</p>
          </div>
          <p className="shrink-0 text-[17px] tracking-[-0.02em] text-[#1d1d1f]">
            {formatMoney(model.price)}
          </p>
        </div>
        <AddiWidget price={model.price} force={model.kind === "ring"} className="mt-2" />

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
                  onClick={() => {
                    setFinish(id);
                    writeProductColor(modelId, id);
                  }}
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
          <div className="mt-5 sm:mt-6">
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

        <div className="product-copy mt-5 sm:mt-6">
          <div aria-hidden className="mb-3.5 h-[0.5px] w-36 bg-[#d8d8de]" />
          {description ? (
            <p className="max-w-[40ch] text-[12px] leading-4 text-soft">
              {description}
            </p>
          ) : null}
          <button
            type="button"
            aria-expanded={showCopy}
            onClick={() => setShowCopy((value) => !value)}
            className="mt-1 text-[12px] text-[#6e6e73] transition-colors hover:text-[#1d1d1f]"
          >
            {showCopy ? "Cerrar descripción" : "Ver toda la descripción"}
            <span aria-hidden className="ml-0.5">
              {showCopy ? "‹" : "›"}
            </span>
          </button>
          {showCopy ? (
            <div ref={specRef}>
              <ProductSpecSheet modelId={modelId} />
            </div>
          ) : null}
        </div>

      </div>

      <div className="shrink-0 border-t border-line bg-white/80 px-4 py-3 backdrop-blur-xl pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="buy-dock">
          <button type="button" onClick={addToCart} className="buy-cart">
            Añadir al carrito
          </button>
          <button type="button" onClick={() => buyNow()} className="buy-now">
            {sales.cta}
          </button>
          {offerAddi ? <AddiCuotasButton onClick={() => buyNow("addi")} /> : null}
        </div>
        {hint ? (
          <p className="mt-2 text-center text-[11px] leading-4 text-soft">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}