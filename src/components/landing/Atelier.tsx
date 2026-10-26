"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  catalog,
  finishLabel,
  finishes,
  formatMoney,
  PRODUCT_HOME,
  productPath,
  type ModelId,
} from "@/lib/catalog";
import { AddiCuotasChip } from "@/components/payments/AddiCuotasChip";
import { useSales } from "@/components/sales/SalesProvider";
import { useMoraStore } from "@/lib/store";
import { loadPayMethods } from "@/payments/methodsClient";

const LOOK_FOCUS: Record<ModelId, string> = {
  aero: "54% 46%",
  titan: "50% 58%",
};

export function Atelier() {
  const sales = useSales();
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

    let played = false;
    let cancelled = false;
    let frame = 0;
    const timers: number[] = [];

    const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;

    const stop = () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      timers.forEach((id) => window.clearTimeout(id));
      root.style.scrollSnapType = "";
    };

    const peek = () => {
      if (played || cancelled || root.scrollLeft > 8) return;
      played = true;
      const reach = Math.min(Math.round(root.clientWidth * 0.055), 28);
      const duration = 1680;
      const started = performance.now();
      root.style.scrollSnapType = "none";

      const tick = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - started) / duration);
        const wave = Math.sin(ease(t) * Math.PI);
        root.scrollLeft = reach * wave;
        if (t < 1) {
          frame = window.requestAnimationFrame(tick);
          return;
        }
        root.scrollLeft = 0;
        root.style.scrollSnapType = "";
      };

      frame = window.requestAnimationFrame(tick);
    };

    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.58) return;
        timers.push(window.setTimeout(peek, 700));
      },
      { threshold: [0.58] },
    );
    seen.observe(root);

    const onTouch = () => stop();
    root.addEventListener("pointerdown", onTouch, { passive: true });
    root.addEventListener("wheel", onTouch, { passive: true });

    return () => {
      stop();
      seen.disconnect();
      root.removeEventListener("pointerdown", onTouch);
      root.removeEventListener("wheel", onTouch);
    };
  }, []);

  function show(index: number) {
    const card = scroller.current?.querySelectorAll<HTMLElement>("[data-world]")[index];
    card?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  return (
    <section id="coleccion" className="worlds-stage">
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
                priority={item.id === "aero"}
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
                        style={{ background: finishes[id].swatch }}
                      />
                    ))}
                  </span>
                  <span className="sr-only">
                    {item.finishes.map((id) => finishLabel(item.id, id)).join(", ")}
                  </span>
                </p>
                <div className="world-dock">
                  <span className="world-price">{formatMoney(item.price)}</span>
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
