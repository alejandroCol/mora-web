"use client";

import Image from "next/image";
import Link from "next/link";
import {
  catalog,
  formatMoney,
  productPath,
  type ModelId,
} from "@/lib/catalog";
import { useMoraStore } from "@/lib/store";

const LOOK: Record<ModelId, { src: string; focus: string; alt: string }> = {
  aero: {
    src: "/lifestyle/pro.jpg",
    focus: "50% 38%",
    alt: "Mora Pro en cerámica, en el ritmo de cada mañana.",
  },
  titan: {
    src: "/lifestyle/ultra.jpg",
    focus: "48% 58%",
    alt: "Mora Ultra en titanio, durante el movimiento.",
  },
};

export function Atelier() {
  const setModel = useMoraStore((state) => state.setModel);

  return (
    <section id="coleccion" className="worlds-stage">
      <h2 className="sr-only">Elige tu Mora</h2>
      <div className="worlds">
        {catalog.map((item, index) => {
          const look = LOOK[item.id];
          return (
            <Link
              key={item.id}
              href={productPath(item.id)}
              onClick={() => setModel(item.id)}
              className="world group"
            >
              <Image
                src={look.src}
                alt={look.alt}
                fill
                sizes="(min-width: 1024px) 60vw, 100vw"
                priority={index === 0}
                className="world-photo"
                style={{ objectPosition: look.focus }}
              />
              <div className="world-veil" />
              <div className="world-copy">
                <p className="world-kicker">{item.line}</p>
                <h3 className="world-name">{item.name}</h3>
                <p className="world-promise">{item.promise}</p>
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
              {index === 0 ? (
                <p className="world-hint" aria-hidden>
                  Desliza hacia Ultra
                </p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
