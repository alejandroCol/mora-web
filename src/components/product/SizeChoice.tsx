"use client";

import { useState } from "react";
import type { SizingMethod } from "@/commerce/types";
import { PRESALE } from "@/lib/presale";
import { SizeGuideFilm } from "./SizeGuideFilm";

const STEPS = [
  {
    title: "Reservas ahora",
    body: "Apartas tu Mora. El precio no cambia.",
  },
  {
    title: "Te llega el medidor",
    body: "Un kit pequeño, antes que el anillo.",
  },
  {
    title: "Confirmas tu número",
    body: "Entras con tu pedido y eliges la talla.",
  },
  {
    title: `El anillo sale el ${PRESALE.deliveryLabel}`,
    body: "Cuando ya tenemos tu talla, se fabrica y se envía.",
  },
] as const;

export function SizeChoice({
  sizing,
  onSizing,
  sizes,
  size,
  onSize,
}: {
  sizing: SizingMethod | null;
  onSizing: (method: SizingMethod) => void;
  sizes: number[];
  size: number;
  onSize: (size: number) => void;
}) {
  const [info, setInfo] = useState(false);
  const [guide, setGuide] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] tracking-[-0.016em] text-[#1d1d1f]">
          ¿Quieres pedir un medidor?
        </p>
        <button
          type="button"
          className="size-info"
          aria-label="Cómo funciona el medidor"
          onClick={() => setInfo(true)}
        >
          i
        </button>
      </div>

      <div className="size-seg mt-3">
        <button
          type="button"
          onClick={() => onSizing("kit")}
          aria-pressed={sizing === "kit"}
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => onSizing("self")}
          aria-pressed={sizing === "self"}
        >
          No
        </button>
      </div>

      {sizing === "kit" ? (
        <p className="mt-2.5 text-[13px] leading-5 text-soft">
          Te lo enviamos primero. Luego eliges el número con tu pedido.
        </p>
      ) : null}

      {sizing === "self" ? (
        <div className="mt-4">
          <p className="text-[13px] tracking-[-0.014em] text-[#1d1d1f]">
            Elige tu talla
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {sizes.map((item) => {
              const on = item === size;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onSize(item)}
                  className={`h-9 min-w-9 rounded-full px-2.5 text-[13px] transition-colors ${
                    on ? "bg-[#1d1d1f] text-white" : "text-soft hover:text-ink"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setGuide(true)}
            className="mt-2.5 text-[13px] tracking-[-0.01em] text-[#6e6e73] hover:text-[#1d1d1f]"
          >
            Ver cómo medir ›
          </button>
        </div>
      ) : null}

      {sizing == null ? (
        <p className="mt-2.5 text-[13px] leading-5 text-soft">
          Elige una opción para reservar.
        </p>
      ) : null}

      {info ? (
        <div
          className="size-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="size-sheet-title"
        >
          <button
            type="button"
            className="size-sheet-dim"
            aria-label="Cerrar"
            onClick={() => setInfo(false)}
          />
          <div className="size-sheet-card">
            <p id="size-sheet-title" className="title-name text-[1.85rem] text-[#1d1d1f]">
              Cómo funciona
            </p>
            <ol className="mt-6 space-y-5">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3.5">
                  <span className="size-step-n">{index + 1}</span>
                  <span>
                    <span className="block text-[15px] tracking-[-0.016em] text-[#1d1d1f]">
                      {step.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-soft">
                      {step.body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="mt-8 flex h-11 w-full items-center justify-center rounded-full bg-[#1d1d1f] text-[17px] tracking-[-0.022em] text-white"
              onClick={() => setInfo(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}

      {guide ? (
        <div className="size-sheet" role="dialog" aria-modal="true">
          <button
            type="button"
            className="size-sheet-dim"
            aria-label="Cerrar"
            onClick={() => setGuide(false)}
          />
          <div className="size-sheet-card">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[15px] tracking-[-0.016em] text-[#1d1d1f]">
                Cómo medir
              </p>
              <button
                type="button"
                onClick={() => setGuide(false)}
                className="text-[13px] text-soft hover:text-ink"
              >
                Listo
              </button>
            </div>
            <div className="mt-4">
              <SizeGuideFilm />
            </div>
            <div className="mt-4 flex flex-wrap gap-1">
              {sizes.map((item) => {
                const on = item === size;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onSize(item)}
                    className={`h-9 min-w-9 rounded-full px-2.5 text-[13px] ${
                      on ? "bg-[#1d1d1f] text-white" : "bg-white text-soft"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
