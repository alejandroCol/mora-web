"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CASE_COLOR_LIST,
  CASE_PRODUCT,
  caseColor,
  landingCaseColor,
  writeCaseColor,
  type CaseColorId,
} from "@/lib/cases";
import { formatMoney } from "@/lib/catalog";
import { track } from "@/growth/track";
import { insightCaseOffer, insightProductCart, useInsightProduct } from "@/insights/client";
import { useMoraStore } from "@/lib/store";
import { checkoutHref } from "@/payments/public";
import { hideCaseOffer } from "@/components/cart/CaseOffer";
import { useSales } from "@/components/sales/SalesProvider";

export function CaseExperience({
  color = null,
  fromCheckout = false,
}: {
  color?: string | null;
  fromCheckout?: boolean;
}) {
  const router = useRouter();
  const sales = useSales();
  const { addCaseToCart, closeCart, openCart } = useMoraStore();
  const opened = landingCaseColor(color);
  const [colorId, setColorId] = useState<CaseColorId>(opened);
  const current = caseColor(colorId);

  useInsightProduct(CASE_PRODUCT.id, CASE_PRODUCT.name);

  useEffect(() => {
    track("ViewContent", {
      content_ids: [CASE_PRODUCT.id],
      content_name: `Mora ${CASE_PRODUCT.name}`,
      content_type: "product",
      content_category: CASE_PRODUCT.line,
      value: CASE_PRODUCT.price,
      currency: "COP",
    });
  }, []);

  useLayoutEffect(() => {
    const next = landingCaseColor(color);
    setColorId(next);
    writeCaseColor(next);
  }, [color]);

  function pick(id: CaseColorId) {
    setColorId(id);
    writeCaseColor(id);
  }

  function trackAdd() {
    track("AddToCart", {
      content_ids: [CASE_PRODUCT.id],
      content_name: `Mora Case ${current.title}`,
      content_type: "product",
      value: CASE_PRODUCT.price,
      currency: "COP",
      num_items: 1,
    });
    insightProductCart(CASE_PRODUCT.id, CASE_PRODUCT.name);
  }

  function addToCart() {
    addCaseToCart(colorId);
    trackAdd();
    if (fromCheckout) {
      hideCaseOffer();
      insightCaseOffer("add");
      closeCart();
      router.push("/checkout");
      return;
    }
    openCart();
  }

  function buyNow() {
    addCaseToCart(colorId);
    closeCart();
    trackAdd();
    if (fromCheckout) {
      hideCaseOffer();
      insightCaseOffer("add");
    }
    router.push(checkoutHref());
  }

  return (
    <div className="hero-wash h-dvh overflow-hidden">
      <div className="flex h-full flex-col lg:flex-row">
        <section className="relative h-[min(50dvh,36rem)] min-h-[20rem] shrink-0 lg:h-auto lg:min-h-0 lg:min-w-0 lg:flex-1">
          <Image
            key={current.id}
            src={current.src}
            alt={`Mora Case en ${current.title}`}
            fill
            unoptimized
            quality={100}
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover"
            style={{ objectPosition: "50% 62%" }}
          />
        </section>
        <aside className="product-sheet relative min-h-0 flex-1 bg-white/70 lg:w-[26rem] lg:flex-none lg:border-l lg:border-line lg:bg-transparent xl:w-[28rem]">
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-12 pt-3 hide-scroll sm:px-8 sm:pb-14 sm:pt-8">
              {fromCheckout ? (
                <button
                  type="button"
                  onClick={() => router.push("/checkout")}
                  className="mb-3 text-[13px] tracking-[-0.01em] text-[#6e6e73] hover:text-[#1d1d1f]"
                >
                  ← Tu pedido
                </button>
              ) : null}
              <div className="flex items-baseline justify-between gap-4">
                <div className="flex min-w-0 items-baseline gap-2">
                  <h1 className="title-name text-[2.35rem] text-[#1d1d1f] sm:text-[2.85rem]">
                    {CASE_PRODUCT.name}
                  </h1>
                  <p className="text-[11px] tracking-[-0.01em] text-soft sm:text-[12px]">
                    {CASE_PRODUCT.line}
                  </p>
                </div>
                <p className="shrink-0 text-[17px] tracking-[-0.02em] text-[#1d1d1f]">
                  {formatMoney(CASE_PRODUCT.price)}
                </p>
              </div>

              <fieldset className="mt-4 sm:mt-7">
                <legend className="text-[12px] text-soft">Color</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CASE_COLOR_LIST.map((item) => {
                    const on = item.id === colorId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => pick(item.id)}
                        aria-pressed={on}
                        aria-label={item.title}
                        className="finish-pick"
                      >
                        <span
                          className={`finish-swatch ${on ? "finish-swatch-on" : ""}`}
                          style={{ background: item.swatch }}
                        />
                        <span className="finish-label">{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="product-copy mt-5 sm:mt-6">
                <div aria-hidden className="mb-3.5 h-[0.5px] w-36 bg-[#d8d8de]" />
                <p className="max-w-[40ch] text-[12px] leading-4 text-soft">
                  {current.whisper} {CASE_PRODUCT.details.join(" ")}
                </p>
              </div>
            </div>

            <div className="shrink-0 border-t border-line bg-white/80 px-4 py-3 backdrop-blur-xl pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:px-8">
              <div className="buy-dock">
                <button type="button" onClick={addToCart} className="buy-cart">
                  Añadir al carrito
                </button>
                <button type="button" onClick={buyNow} className="buy-now">
                  {sales.cta}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
