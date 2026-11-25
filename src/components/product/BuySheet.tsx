"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  finishLabel,
  products,
  resolveFinish,
  writeProductColor,
  type ModelId,
} from "@/lib/catalog";
import { track } from "@/growth/track";
import { usePricing, useSales } from "@/components/sales/SalesProvider";
import { insightProductCart } from "@/insights/client";
import { useMoraStore } from "@/lib/store";
import { AddiCuotasButton } from "@/components/payments/AddiCuotasButton";
import { addiAmountAllowed, checkoutHref } from "@/payments/public";
import { loadPayMethods } from "@/payments/methodsClient";
import { FreeShipping } from "./FreeShipping";
import { ProductPrice } from "./ProductPrice";
import { ProductReviews } from "./ProductReviews";
import { ProductFinePrint, ProductSpecSheet } from "./ProductSpecSheet";
import { SizeChoice } from "./SizeChoice";
import { SoldCount } from "./SoldCount";

export function BuySheet({
  modelId,
  left = {},
  out = [],
  panel = false,
}: {
  modelId: ModelId;
  /** Dentro de una hoja de alto fijo (galería): scroll propio y barra pegada abajo, siempre. */
  panel?: boolean;
  left?: Record<string, number>;
  out?: string[];
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
  const pricing = usePricing();
  const model = products[modelId];
  const price = pricing[modelId];
  const finishId = model.finishes.includes(selection.finishId)
    ? selection.finishId
    : model.finishes[0];
  const sizing = selection.sizing;
  const [need, setNeed] = useState("");
  const [addiRange, setAddiRange] = useState<{ minCop: number; maxCop: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);

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

  // En celular la barra de compra flota sobre la página: la hoja deja debajo justo su alto,
  // para que la última línea no quede tapada (el alto cambia con Addi y con el aviso).
  useEffect(() => {
    const sheet = sheetRef.current;
    const bar = barRef.current;
    if (!sheet || !bar) return;
    const sync = () => sheet.style.setProperty("--buy-bar-h", `${bar.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  /** La barra se toca desde cualquier punto de la página: si falta la talla, se la muestra. */
  function showSizes() {
    sizeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function validateSelection() {
    if ((sizing ?? "self") === "self" && !model.sizes.includes(selection.size)) {
      setNeed(sales.needSize);
      showSizes();
      return false;
    }
    if ((sizing ?? "self") !== "kit" && out.includes(`${finishId}:${selection.size}`)) {
      setNeed("Esa talla no está.");
      showSizes();
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
      value: price,
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

  useEffect(() => {
    if ((sizing ?? "self") === "kit") return;
    if (!out.includes(`${finishId}:${selection.size}`)) return;
    const next = model.sizes.find((item) => !out.includes(`${finishId}:${item}`));
    if (next != null) setSize(next);
  }, [finishId, model.sizes, out, selection.size, setSize, sizing]);

  const offerAddi =
    addiRange != null &&
    (model.kind === "ring" ||
      addiAmountAllowed(price, addiRange.minCop, addiRange.maxCop));

  const hint = need || (sizing === "self" ? sales.deliveryHint : "");

  return (
    <div
      ref={sheetRef}
      className={`flex flex-col lg:h-full lg:min-h-0 ${panel ? "buy-panel h-full min-h-0" : ""}`}
    >
      <div className="buy-scroll px-5 pt-2.5 hide-scroll sm:px-8 sm:pt-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
              <h1 className="title-name text-[clamp(2.05rem,9.4vw,2.35rem)] text-[#1d1d1f] sm:text-[2.6rem]">
                <span className="sr-only">Mora </span>
                {model.name}
              </h1>
              <span className="flex items-center gap-1.5 pb-[3px]">
                <span className="text-[11.5px] leading-none tracking-[-0.01em] text-soft">{model.line}</span>
                <FreeShipping className="ship-free-xs shrink-0" />
              </span>
            </div>
            <SoldCount modelId={modelId} className="mt-1.5" />
          </div>
          <ProductPrice value={price} />
        </div>

        <fieldset className="mt-5 sm:mt-6">
          <legend className="sr-only">Color</legend>
          <div className="flex gap-2">
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
          <div ref={sizeRef} className="mt-5 sm:mt-6">
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
              left={left[`${finishId}:${selection.size}`] ?? null}
              out={model.sizes.filter((item) => out.includes(`${finishId}:${item}`))}
            />
          </div>
        ) : null}

        <div className="mt-8 space-y-8 sm:mt-9">
          <ProductSpecSheet modelId={modelId} />
          <ProductReviews />
          <ProductFinePrint />
        </div>
      </div>

      <div ref={barRef} className="buy-bar">
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
          <p className={`buy-bar-hint ${need ? "buy-bar-need" : ""}`} role={need ? "alert" : undefined}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}