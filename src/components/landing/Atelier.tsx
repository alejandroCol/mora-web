"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  catalog,
  finishLabel,
  formatMoney,
  PRODUCT_HOME,
  productPath,
  resolveFinish,
  type ModelId,
} from "@/lib/catalog";
import { AddiCuotasChip } from "@/components/payments/AddiCuotasChip";
import { usePricing, useSales } from "@/components/sales/SalesProvider";
import { useMoraStore } from "@/lib/store";
import { loadPayMethods } from "@/payments/methodsClient";

const LOOK_FOCUS: Record<ModelId, string> = {
  aero: "54% 46%",
  titan: "50% 58%",
};

export function Atelier() {
  const sales = useSales();
  const pricing = usePricing();
  const setModel = useMoraStore((state) => state.setModel);
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [addiRange, setAddiRange] = useState<{ minCop: number; maxCop: number } | null>(null);

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
    const root = scroller.current;
    if (!root) return;
    const cards = [...root.querySelectorAll<HTMLElement>("[data-world]")];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = cards.indexOf(visible.target as HTMLElement);
        if (index >= 0) setActive(index);
      },
      { root, threshold: [0.45, 0.6, 0.75] },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;

    // Transform, no scrollLeft: iOS ignora o re-ajusta el scroll programático en un carrusel con snap.
    let played = false;
    let timer = 0;

    const stop = () => {
      window.clearTimeout(timer);
      root.classList.remove("worlds-peek");
    };

    const peek = () => {
      if (played || root.scrollLeft > 8) return;
      played = true;
      root.classList.add("worlds-peek");
    };

    const seen = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (!entry.isIntersecting || entry.intersectionRatio < 0.9) return;
        timer = window.setTimeout(peek, 260);
      },
      { threshold: [0.9] },
    );
    seen.observe(root);

    const onEnd = (event: AnimationEvent) => {
      if (event.animationName === "world-peek") root.classList.remove("worlds-peek");
    };
    root.addEventListener("animationend", onEnd);
    root.addEventListener("pointerdown", stop, { passive: true });
    root.addEventListener("wheel", stop, { passive: true });

    return () => {
      stop();
      seen.disconnect();
      root.removeEventListener("animationend", onEnd);
      root.removeEventListener("pointerdown", stop);
      root.removeEventListener("wheel", stop);
    };
  }, []);

  function show(index: number) {
    const card = scroller.current?.querySelectorAll<HTMLElement>("[data-world]")[index];
    card?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  return (
    <section id="coleccion" className="worlds-stage snap-page">
      <h2 className="sr-only">Elige tu Mora</h2>
      <div className="world-pager" role="tablist" aria-label="Pro o Ultra">
        {catalog.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === index}
            className={active === index ? "on" : ""}
            onClick={() => show(index)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div ref={scroller} className="worlds">
        {catalog.map((item) => {
          const home = PRODUCT_HOME[item.id];
          return (
            <Link
              key={item.id}
              href={productPath(item.id)}
              data-world
              onClick={() => setModel(item.id)}
              className="world group world-light"
            >
              <Image
                src={home.src}
                alt={home.alt}
                fill
                unoptimized
                quality={100}
                sizes="(min-width: 1024px) 50vw, 100vw"
                loading="eager"
                draggable={false}
                onLoad={(event) => void event.currentTarget.decode().catch(() => undefined)}
                className="world-photo"
                style={{ objectPosition: LOOK_FOCUS[item.id] }}
              />
              <div className="world-veil" />
              <div className="world-copy">
                <p className="world-kicker">{item.line}</p>
                <h3 className="world-name">{item.name}</h3>
                <p className="world-finishes">
                  <span className="world-finishes-label">Disponible en</span>
                  <span className="world-dots" aria-hidden>
                    {item.finishes.map((id) => (
                      <span
                        key={id}
                        className="world-dot"
                        style={{ background: resolveFinish(item.id, id).swatch }}
                      />
                    ))}
                  </span>
                  <span className="sr-only">
                    {item.finishes.map((id) => finishLabel(item.id, id)).join(", ")}
                  </span>
                </p>
                <div className="world-dock">
                  <span className="world-price">{formatMoney(pricing[item.id])}</span>
                  <div className="world-actions">
                    <span className="elegir-cta">
                      {sales.cta}
                      <span aria-hidden className="elegir-cta-arrow">
                        ›
                      </span>
                    </span>
                    {addiRange ? <AddiCuotasChip /> : null}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {active === 0 ? <span className="world-swipe-hint" aria-hidden /> : null}
    </section>
  );
}
