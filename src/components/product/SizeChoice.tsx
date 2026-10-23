"use client";

import { useEffect, useRef, useState } from "react";
import type { SizingMethod } from "@/commerce/types";
import { useSales } from "@/components/sales/SalesProvider";
import { SizeGuideFilm } from "./SizeGuideFilm";

const SIZE_CHART = [
  { size: 8, around: "5,75 cm", diameter: "18,3 mm" },
  { size: 9, around: "6 cm", diameter: "19,1 mm" },
  { size: 10, around: "6,28 cm", diameter: "20 mm" },
  { size: 11, around: "6,54 cm", diameter: "20,8 mm" },
  { size: 12, around: "6,79 cm", diameter: "21,6 mm" },
  { size: 13, around: "7 cm", diameter: "22,3 mm" },
];

function SizeChart({ active }: { active: number }) {
  return (
    <div className="mt-3 px-1 pb-1">
      <p className="text-[14px] tracking-[-0.018em] text-[#1d1d1f]">Según tu medida</p>
      <p className="mt-0.5 text-[12px] leading-4 text-[#6e6e73]">Contorno del dedo, en centímetros.</p>
      <table className="mt-2.5 w-full border-collapse text-left">
        <thead>
          <tr className="text-[11px] text-[#8e8e93]">
            <th className="pb-1.5 pl-2 font-normal">Talla</th>
            <th className="pb-1.5 font-normal">Contorno</th>
            <th className="pb-1.5 pr-2 text-right font-normal">Diámetro</th>
          </tr>
        </thead>
        <tbody>
          {SIZE_CHART.map((row) => {
            const on = row.size === active;
            return (
              <tr key={row.size} className={on ? "bg-[#f5f5f7]" : ""}>
                <td className="rounded-l-lg py-1.5 pl-2 text-[14px] tabular-nums text-[#1d1d1f]">{row.size}</td>
                <td className="py-1.5 text-[14px] tabular-nums text-[#1d1d1f]">{row.around}</td>
                <td className="rounded-r-lg py-1.5 pr-2 text-right text-[13px] tabular-nums text-[#6e6e73]">{row.diameter}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SizeChoice({
  prompt = 0,
  sizing,
  onSizing,
  sizes,
  size,
  onSize,
}: {
  prompt?: number;
  sizing: SizingMethod | null;
  onSizing: (method: SizingMethod) => void;
  sizes: number[];
  size: number;
  onSize: (size: number) => void;
}) {
  const sales = useSales();
  const [info, setInfo] = useState(false);
  const [guide, setGuide] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const ask = prompt > 0 && !sizing;

  useEffect(() => {
    if (!ask || !rowRef.current) return;
    const node = rowRef.current;
    const scroller = node.closest(".overflow-y-auto");
    if (!(scroller instanceof HTMLElement)) return;
    const top = node.getBoundingClientRect().top;
    const bounds = scroller.getBoundingClientRect();
    if (top >= bounds.top && node.getBoundingClientRect().bottom <= bounds.bottom) return;
    const delta = top - bounds.top;
    scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + delta - 12), behavior: "smooth" });
  }, [ask, prompt]);

  return (
    <div>
      <div>
        <div className="flex flex-wrap justify-start gap-1" role="group" aria-label="Talla">
          {sizes.map((item) => {
            const on = item === size;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={on}
                onClick={() => onSize(item)}
                className={`grid h-8 w-8 place-items-center rounded-full text-[14px] tabular-nums tracking-[-0.02em] transition-colors ${
                  on ? "bg-[#1d1d1f] text-white" : "text-[#1d1d1f] hover:bg-black/[0.05]"
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
          className="mt-3 inline-flex h-8 items-center rounded-full bg-[#efeff2] px-3 text-[13px] tracking-[-0.01em] text-[#1d1d1f] transition-colors hover:bg-[#e6e6ea]"
        >
          Cómo medir mi talla?
        </button>
      </div>

      <div ref={rowRef} className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="text-[14px] tracking-[-0.018em] text-[#1d1d1f] sm:text-[15px]">
          ¿Quieres pedir un medidor?
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="size-info"
            aria-label="Cómo funciona el medidor"
            onClick={() => setInfo(true)}
          >
            i
          </button>
          {ask ? <p className="size-ask">Selecciona una opción</p> : null}
          <div key={prompt} className={`size-seg size-seg-inline ${ask ? "size-hop" : ""}`}>
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
              aria-pressed={sizing !== "kit"}
            >
              No
            </button>
          </div>
        </div>
      </div>

      {sizing === "kit" ? (
        <p className="mt-2.5 text-[13px] leading-5 text-soft">
          Te lo enviamos primero. Luego eliges el número con tu pedido.
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
              {sales.sizeSteps.map((step, index) => (
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
        <div className="size-sheet size-sheet-mid" role="dialog" aria-modal="true" aria-label="Cómo medir mi talla">
          <button
            type="button"
            className="size-sheet-dim"
            aria-label="Cerrar"
            onClick={() => setGuide(false)}
          />
          <div className="size-sheet-card size-sheet-card-slim">
            <button type="button" className="size-x" aria-label="Cerrar" onClick={() => setGuide(false)}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M3.2 3.2 10.8 10.8M10.8 3.2 3.2 10.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <SizeGuideFilm />
            <SizeChart active={size} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
