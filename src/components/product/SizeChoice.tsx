"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SizingMethod } from "@/commerce/types";
import { useSales } from "@/components/sales/SalesProvider";
import { resolveKnownPxPerMm } from "@/lib/screenScale";
import { leftLabel } from "@/commerce/scarcity";
import { RING_SIZES, aroundLabel, diameterLabel, ringSize } from "@/lib/ringSizes";
import { SizeGuideFilm } from "./SizeGuideFilm";
import { SizerHologram } from "./SizerHologram";

// El medidor virtual solo se descarga cuando alguien lo abre.
const RingSizer = dynamic(() => import("@/components/medidor/RingSizer").then((mod) => mod.RingSizer), {
  ssr: false,
});

function SizeChart({ active }: { active: number }) {
  return (
    <div className="mt-3 px-1 pb-1">
      <p className="text-[14px] tracking-[-0.018em] text-[#1d1d1f]">Según tu medida</p>
      <p className="mt-0.5 text-[12px] leading-4 text-[#6e6e73]">Contorno del dedo, en centímetros.</p>
      <SizeTable active={active} />
    </div>
  );
}

function SizeTable({ active }: { active: number }) {
  return (
    <table className="mt-2.5 w-full border-collapse text-left">
      <thead>
        <tr className="text-[11px] text-[#8e8e93]">
          <th className="pb-1.5 pl-2 font-normal">Talla</th>
          <th className="pb-1.5 font-normal">Por dentro</th>
          <th className="pb-1.5 pr-2 text-right font-normal">Contorno</th>
        </tr>
      </thead>
      <tbody>
        {RING_SIZES.map((row) => {
          const on = row.size === active;
          return (
            <tr key={row.size} className={on ? "bg-white" : ""}>
              <td className="rounded-l-lg py-1.5 pl-2 text-[14px] tabular-nums text-[#1d1d1f]">{row.size}</td>
              <td className="py-1.5 text-[13px] tabular-nums text-[#1d1d1f]">{diameterLabel(row)}</td>
              <td className="rounded-r-lg py-1.5 pr-2 text-right text-[13px] tabular-nums text-[#6e6e73]">{aroundLabel(row)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      aria-hidden
      className={`text-[#8e8e93] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function JewelryNote({ onGuide }: { onGuide: () => void }) {
  const smallest = RING_SIZES[0];
  return (
    <div className="px-2">
      <p className="text-[13px] leading-[1.4] tracking-[-0.012em] text-[#6e6e73]">
        <span className="text-[#1d1d1f]">¿En joyería eres 5 o 6?</span> La talla más pequeña de Mora es la{" "}
        {smallest.size} ({diameterLabel(smallest)} por dentro). Mora{" "}
        <span className="font-semibold text-[#1d1d1f]">va en el dedo índice</span>, que suele ser más grueso que el
        anular: mide ese dedo o pide el medidor <span className="text-[#1d1d1f]">totalmente gratis</span>.
      </p>
      <button
        type="button"
        onClick={onGuide}
        className="mt-2 text-[13px] text-[#1d1d1f] underline decoration-black/20 underline-offset-4"
      >
        Ver cómo medirme
      </button>
    </div>
  );
}

function SizeEquivalence({
  size,
  noteFirst,
  onGuide,
}: {
  size: number;
  noteFirst: boolean;
  onGuide: () => void;
}) {
  const divider = <div className="mx-2 my-3 h-px bg-black/[0.06]" />;
  return (
    <div id="size-equivalence" className="size-equiv mt-2 max-w-[22rem] rounded-[14px] bg-[#f5f5f7] px-2.5 pb-3 pt-3">
      {noteFirst ? (
        <>
          <JewelryNote onGuide={onGuide} />
          {divider}
        </>
      ) : null}
      <p className="px-2 text-[13px] tracking-[-0.012em] text-[#1d1d1f]">
        Medidas · <span className="font-semibold">dedo índice</span>
      </p>
      <SizeTable active={size} />
      {noteFirst ? null : (
        <>
          {divider}
          <JewelryNote onGuide={onGuide} />
        </>
      )}
      <p className="mt-2.5 px-2 text-[11px] leading-4 text-[#8e8e93]">
        Medidas aproximadas, del anillo por dentro.
      </p>
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
  left = null,
  out = [],
}: {
  prompt?: number;
  sizing: SizingMethod | null;
  onSizing: (method: SizingMethod) => void;
  sizes: number[];
  size: number;
  onSize: (size: number) => void;
  /** Aviso de la talla elegida, en el color actual. */
  left?: number | null;
  /** Tallas sin unidades en el color actual. */
  out?: number[];
}) {
  const sales = useSales();
  const [info, setInfo] = useState(false);
  const [guide, setGuide] = useState(false);
  const [virtual, setVirtual] = useState(false);
  // El medidor virtual solo se ofrece si la pantalla se reconoce (iPhone y Android de la tabla):
  // ahí mide sin calibrar. En PC y en equipos sin reconocer el botón no aparece.
  const [canMeasure, setCanMeasure] = useState(false);
  useEffect(() => {
    let alive = true;
    void resolveKnownPxPerMm().then((scale) => {
      if (alive) setCanMeasure(scale !== null);
    });
    return () => {
      alive = false;
    };
  }, []);
  const [equiv, setEquiv] = useState<"closed" | "sizes" | "note">("closed");
  const open = equiv !== "closed";
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
        <div className="@container">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 @min-[19.5rem]:flex-nowrap">
            <div className="flex min-w-0 max-w-[14.5rem] grow flex-wrap items-center gap-[5px]" role="group" aria-label="Talla">
              {sizes.map((item) => {
                const blocked = out.includes(item);
                const on = item === size && !blocked;
                const row = ringSize(item);
                const note = on && left ? leftLabel(left) : "";
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={blocked}
                    aria-pressed={on}
                    aria-label={
                      blocked
                        ? `Talla ${item}, agotada`
                        : row
                          ? `Talla ${item}, ${diameterLabel(row)} por dentro${note ? `, ${note}` : ""}`
                          : `Talla ${item}${note ? `, ${note}` : ""}`
                    }
                    onClick={() => onSize(item)}
                    className={`flex aspect-square max-w-[1.8rem] shrink-0 grow basis-6 items-center justify-center rounded-full text-[12.5px] tracking-[-0.02em] tabular-nums transition-colors ${
                      blocked
                        ? "cursor-default bg-[#ebebef] text-[#1d1d1f]/30"
                        : on
                          ? "bg-[#1d1d1f] text-white"
                          : "bg-[#ebebef] text-[#1d1d1f] hover:bg-[#e0e0e5]"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-controls="size-equivalence"
              onClick={() => setEquiv("note")}
              className="whitespace-nowrap py-1 text-[11px] leading-none tracking-[-0.005em] text-[#6e6e73] underline decoration-black/20 underline-offset-[3px] transition-colors hover:text-[#1d1d1f]"
            >
              No encuentro mi talla
            </button>
          </div>
        </div>
        {left ? (
          <p className="mt-1.5">
            <span className="inline-flex h-[1.35rem] items-center rounded-full bg-[#1d1d1f] px-2 text-[11px] leading-none tracking-[-0.02em] text-white tabular-nums">
              {leftLabel(left)}
            </span>
          </p>
        ) : null}
        {/* En celular (puntero táctil) la fila es de una sola línea: lo que no cabe baja de renglón y
            queda recortado, así que «Medidas», que va de último, desaparece solo en pantallas angostas.
            En PC la fila envuelve normal. */}
        <div className={`${left ? "mt-2" : "mt-3"} flex flex-wrap items-center gap-1.5 [@media(pointer:coarse)]:h-8 [@media(pointer:coarse)]:gap-1 [@media(pointer:coarse)]:overflow-hidden`}>
          {canMeasure ? (
            <button
              type="button"
              onClick={() => setVirtual(true)}
              className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full bg-[#1d1d1f] px-2.5 text-[13px] [@media(pointer:coarse)]:text-[12.5px] tracking-[-0.01em] text-white transition-colors hover:bg-[#3a3a3c]"
            >
              Medidor virtual
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setGuide(true)}
            className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full bg-[#efeff2] px-2.5 text-[13px] [@media(pointer:coarse)]:text-[12.5px] [@media(pointer:coarse)]:px-2 tracking-[-0.01em] text-[#1d1d1f] transition-colors hover:bg-[#e6e6ea]"
          >
            Cómo medir mi talla?
          </button>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="size-equivalence"
            onClick={() => setEquiv(open ? "closed" : "sizes")}
            className={`inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[13px] [@media(pointer:coarse)]:text-[12.5px] [@media(pointer:coarse)]:px-2 tracking-[-0.01em] text-[#1d1d1f] transition-colors ${
              open ? "bg-[#e3e3e8]" : "bg-[#efeff2] hover:bg-[#e6e6ea]"
            }`}
          >
            Medidas
            <Chevron open={open} />
          </button>
        </div>
        {open ? (
          <SizeEquivalence size={size} noteFirst={equiv === "note"} onGuide={() => setGuide(true)} />
        ) : null}
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
          <SizerHologram />
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
        <p className="mt-3 rounded-[10px] bg-[#f2f2f7] px-3.5 py-2.5 text-[13px] leading-[1.35] tracking-[-0.012em] text-[#6e6e73]">
          {sales.sizerNote}
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

      {virtual
        ? createPortal(
            <RingSizer
              onClose={() => setVirtual(false)}
              onPick={(picked) => {
                if (sizes.includes(picked) && !out.includes(picked)) onSize(picked);
                setVirtual(false);
              }}
            />,
            document.body,
          )
        : null}

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
