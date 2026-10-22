"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  catalog,
  finishLabel,
  finishes,
  formatMoney,
  productPath,
  type ModelId,
} from "@/lib/catalog";
import { useMoraStore } from "@/lib/store";

const LOOK: Record<ModelId, { src: string; focus: string; alt: string }> = {
  aero: {
    src: "/lifestyle/pro-home.jpg",
    focus: "50% 58%",
    alt: "Mora Pro sobre piedra clara.",
  },
  titan: {
    src: "/lifestyle/ultra.jpg",
    focus: "48% 58%",
    alt: "Mora Ultra en titanio, durante el movimiento.",
  },
};

export function Atelier() {
  const setModel = useMoraStore((state) => state.setModel);
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

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
          const look = LOOK[item.id];
          return (
            <Link
              key={item.id}
              href={productPath(item.id)}
              data-world
              onClick={() => setModel(item.id)}
              className={`world group ${item.id === "aero" ? "world-light" : ""}`}
            >
              <Image
                src={look.src}
                alt={look.alt}
                fill
                unoptimized
                quality={100}
                sizes="(min-width: 1024px) 50vw, 84vw"
                priority={item.id === "aero"}
                className="world-photo"
                style={{ objectPosition: look.focus }}
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
                  <span className="elegir-cta">
                    Reservar
                    <span aria-hidden className="elegir-cta-arrow">
                      ›
                    </span>
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
