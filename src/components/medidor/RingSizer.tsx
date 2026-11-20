"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { productPath } from "@/lib/catalog";
import { RING_SIZES, aroundLabel, diameterLabel, type RingSizeRow } from "@/lib/ringSizes";
import {
  CARD_CORNER_MM,
  CARD_WIDTH_MM,
  SCALE_MAX,
  SCALE_MIN,
  currentZoom,
  guessPxPerMm,
  knownPxPerMm,
  loadScale,
  resolveKnownPxPerMm,
  saveScale,
} from "@/lib/screenScale";
import { useMoraStore } from "@/lib/store";
import "./medidor.css";

const D_MIN = 14;
const D_MAX = 25;
const D_START = 18.3;
/** Hasta aquí de diferencia con la ficha se lee como «coincide». */
const EXACT_MM = 0.15;
/** Fuera de la tabla, pero tan cerca que la talla del borde aún sirve. */
const EDGE_MM = 0.4;
/** Grosor del aro guía que se dibuja alrededor del círculo. */
const BAND_MM = 2.6;
const HELP_KEY = "mora.medidor.guia.v1";

const mmFormat = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mm = (value: number) => mmFormat.format(value);

type Reading = {
  /** Lo que va en grande: «9», «<7». */
  big: string;
  /** Talla recomendada, si hay una de Mora que sirva. */
  row: RingSizeRow | null;
  exact: boolean;
  title: string;
  note: string;
};

function readDiameter(d: number): Reading {
  const first = RING_SIZES[0];
  const last = RING_SIZES[RING_SIZES.length - 1];
  const measures = (row: RingSizeRow) => `${diameterLabel(row)} por dentro · ${aroundLabel(row)} de contorno.`;

  const exact = RING_SIZES.find((row) => Math.abs(row.diameterMm - d) <= EXACT_MM);
  if (exact) {
    return {
      big: String(exact.size),
      row: exact,
      exact: true,
      title: `Coincide con la talla ${exact.size}`,
      note: measures(exact),
    };
  }
  if (d < first.diameterMm) {
    if (first.diameterMm - d <= EDGE_MM) {
      return {
        big: String(first.size),
        row: first,
        exact: false,
        title: `Un poco menos que la ${first.size}`,
        note: `La ${first.size} es nuestra talla más pequeña (${diameterLabel(first)}). Te quedaría algo holgada.`,
      };
    }
    return {
      big: `<${first.size}`,
      row: null,
      exact: false,
      title: `Más pequeña que la ${first.size}`,
      note: `Nuestra talla más pequeña es la ${first.size} (${diameterLabel(first)}). Mora va en el dedo índice: prueba con un anillo de ese dedo.`,
    };
  }
  if (d > last.diameterMm) {
    if (d - last.diameterMm <= EDGE_MM) {
      return {
        big: String(last.size),
        row: last,
        exact: false,
        title: `Un poco más que la ${last.size}`,
        note: `La ${last.size} es nuestra talla más grande (${diameterLabel(last)}). Te quedaría algo ajustada.`,
      };
    }
    return {
      big: `>${last.size}`,
      row: null,
      exact: false,
      title: `Más grande que la ${last.size}`,
      note: `Nuestra talla más grande es la ${last.size} (${diameterLabel(last)}).`,
    };
  }
  const upperIndex = RING_SIZES.findIndex((row) => row.diameterMm > d);
  const lower = RING_SIZES[upperIndex - 1];
  const upper = RING_SIZES[upperIndex];
  const middle = (lower.diameterMm + upper.diameterMm) / 2;
  // Sin empujar hacia ninguna: se dice la más cercana (en el empate exacto, la menor).
  const tie = Math.abs(d - middle) < 0.01;
  const near = d < middle || tie ? lower : upper;
  return {
    big: String(near.size),
    row: near,
    exact: false,
    title: `Entre la ${lower.size} y la ${upper.size}`,
    note: tie ? "Justo en medio de las dos." : `Más cerca de la ${near.size}.`,
  };
}

/* ───────────────────────── Dial ───────────────────────── */

type DialMark = { at: number; label: string; on?: boolean };

/**
 * Regla que corre bajo una aguja fija. Se arrastra desde cualquier punto y el movimiento es
 * relativo (no salta al dedo), así que un paso son varios px de recorrido: sirve para afinar.
 */
function Dial({
  value,
  min,
  max,
  step,
  decimals,
  gap,
  marks = [],
  label,
  valueText,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  /** px de recorrido por paso. */
  gap: number;
  marks?: DialMark[];
  label: string;
  valueText: string;
  onChange: (value: number) => void;
}) {
  const drag = useRef<{ x: number; from: number } | null>(null);
  const wheel = useRef(0);
  const steps = Math.round((max - min) / step);
  const offset = ((value - min) / step) * gap;

  const set = (raw: number) => {
    const clamped = Math.min(max, Math.max(min, raw));
    const next = Number((Math.round(clamped / step) * step).toFixed(decimals));
    if (next !== value) onChange(next);
  };

  const ticks = (every: number, height: number, alpha: number) => (
    <div
      className="absolute bottom-0 left-0 w-full"
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(to right, rgba(29,29,31,${alpha}) 0 1px, transparent 1px ${gap * every}px)`,
      }}
    />
  );

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className="mdr-dial relative h-[56px] min-w-0 flex-1 overflow-hidden"
      onPointerDown={(event) => {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Puntero ya soltado: el arrastre sigue mientras pase por la regla.
        }
        drag.current = { x: event.clientX, from: value };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        set(drag.current.from - ((event.clientX - drag.current.x) / gap) * step);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onWheel={(event) => {
        wheel.current += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        const moved = Math.trunc(wheel.current / gap);
        if (!moved) return;
        wheel.current -= moved * gap;
        set(value + moved * step);
      }}
      onKeyDown={(event) => {
        const big = event.shiftKey ? 10 : 1;
        if (event.key === "ArrowRight" || event.key === "ArrowUp") set(value + step * big);
        else if (event.key === "ArrowLeft" || event.key === "ArrowDown") set(value - step * big);
        else return;
        event.preventDefault();
      }}
    >
      <div
        className="absolute inset-y-0 left-1/2 will-change-transform"
        style={{ width: steps * gap + 1, transform: `translate3d(${-(offset + 0.5)}px,0,0)` }}
      >
        {ticks(1, 8, 0.16)}
        {ticks(5, 13, 0.26)}
        {ticks(10, 19, 0.5)}
        {marks.map((mark) => (
          <span
            key={mark.label}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: ((mark.at - min) / step) * gap + 0.5 }}
          >
            <span
              className={`text-[12px] leading-[16px] tabular-nums transition-colors duration-200 ${
                mark.on ? "font-semibold text-[var(--mdr-ink)]" : "text-[var(--mdr-faint)]"
              }`}
            >
              {mark.label}
            </span>
            <span
              className={`mt-[13px] h-[27px] w-px transition-colors duration-200 ${
                mark.on ? "bg-[var(--mdr-accent)]" : "bg-[rgba(111,97,184,0.45)]"
              }`}
            />
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-0 left-1/2 top-[19px] flex -translate-x-1/2 flex-col items-center">
        <svg width="8" height="5" viewBox="0 0 8 5" className="flex-none" aria-hidden>
          <path d="M0 0h8L4 5z" fill="var(--mdr-accent)" />
        </svg>
        <span className="-mt-px w-[1.5px] flex-1 bg-[var(--mdr-accent)]" />
      </div>
    </div>
  );
}

function StepButton({ sign, label, onPress }: { sign: 1 | -1; label: string; onPress: () => void }) {
  return (
    <button type="button" aria-label={label} className="mdr-round" onClick={onPress}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d={sign > 0 ? "M6 1.5v9M1.5 6h9" : "M1.5 6h9"} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/* ───────────────────────── Marco ───────────────────────── */

/** Aro de metal para los dibujos (guía y resultado). */
function MetalDefs() {
  return (
    <defs>
      <linearGradient id="mdr-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f6f6f8" />
        <stop offset="28%" stopColor="#b4b4bc" />
        <stop offset="52%" stopColor="#f0f0f3" />
        <stop offset="76%" stopColor="#9a9aa3" />
        <stop offset="100%" stopColor="#e4e4e9" />
      </linearGradient>
    </defs>
  );
}

function TopBar({ onClose, action }: { onClose?: () => void; action?: ReactNode }) {
  const lead = "flex h-9 w-9 flex-none items-center justify-center rounded-full text-[var(--mdr-ink)]";
  return (
    <header className="flex h-[52px] flex-none items-center justify-between px-3">
      {onClose ? (
        <button type="button" aria-label="Cerrar medidor" className={lead} onClick={onClose}>
          <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
            <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      ) : (
        <Link href="/" aria-label="Volver a Mora" className={lead}>
          <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden>
            <path d="M6.5 1.5 1.5 7l5 5.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
      <p className="min-w-0 flex-1 truncate px-1 text-center text-[14px] font-medium tracking-[-0.018em]">Medidor virtual</p>
      <div className="flex w-[76px] flex-none justify-end">{action}</div>
    </header>
  );
}

/* ───────────────────────── Calibrar ───────────────────────── */

function Calibrate({
  initial,
  zoomChanged,
  onDone,
  onClose,
}: {
  initial: number;
  zoomChanged: boolean;
  onDone: (pxPerMm: number) => void;
  onClose?: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const edge = useRef<{ x: number; from: number } | null>(null);
  const [value, setValue] = useState(initial);
  const [limit, setLimit] = useState(SCALE_MAX);
  // Márgenes mínimos: en un teléfono angosto la tarjeta (54 mm) ocupa casi todo el ancho.
  const x0 = 14;
  const y0 = 44;

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => {
      const widest = (el.clientWidth - x0 - 8) / CARD_WIDTH_MM;
      setLimit(Math.max(SCALE_MIN + 0.5, Math.min(SCALE_MAX, Math.floor(widest * 100) / 100)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(value, limit);
  const width = CARD_WIDTH_MM * scale;
  const nudge = (by: number) =>
    setValue(Number(Math.min(limit, Math.max(SCALE_MIN, scale + by)).toFixed(2)));

  return (
    <>
      <TopBar onClose={onClose} />
      <div className="mdr-in flex-none px-7 pt-2">
        <p className="mdr-caps">Calibración · una sola vez</p>
        <h1 className="mdr-title mt-2 text-[27px]">Calibra tu pantalla para poder medir</h1>
        <p className="mt-2 text-[14px] leading-[1.45] text-[var(--mdr-gray)]">
          Apoya <span className="text-[var(--mdr-ink)]">cualquier tarjeta</span> de pie, con su esquina en la marca.
          Desliza hasta que la línea toque el borde derecho.
        </p>
        <p className="mt-3 flex gap-2 text-[12px] leading-[1.45] text-[var(--mdr-gray)]">
          <svg width="14" height="16" viewBox="0 0 14 16" className="mt-[1px] flex-none" aria-hidden>
            <path d="M7 1.2 1.6 3.2v4c0 3.2 2.1 5.9 5.4 7.4 3.3-1.5 5.4-4.2 5.4-7.4v-4L7 1.2Z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
            <path d="m4.7 7.9 1.7 1.7 3-3.2" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            <span className="text-[var(--mdr-ink)]">Es solo una referencia de medida.</span> Sin cámara, sin fotos, sin
            leer datos.
          </span>
        </p>
        {zoomChanged ? (
          <p className="mdr-hair-t mt-3 pt-3 text-[12.5px] leading-[1.4] text-[var(--mdr-ink)]">
            Cambió el zoom de la pantalla. Ajusta de nuevo para que la medida siga siendo real.
          </p>
        ) : null}
      </div>

      <div ref={stage} className="pointer-events-none relative mt-4 min-h-0 flex-1 overflow-hidden">
        {/* Tarjeta virtual: solo importa el ancho (53,98 mm). */}
        <div
          className="absolute overflow-hidden"
          style={{
            left: x0,
            top: y0,
            width,
            bottom: -40,
            borderTopLeftRadius: CARD_CORNER_MM * scale,
            borderTopRightRadius: CARD_CORNER_MM * scale,
            background: "linear-gradient(155deg, #3a3842 0%, #1d1d1f 46%, #121214 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, #000 50%, transparent 97%)",
            maskImage: "linear-gradient(to bottom, #000 50%, transparent 97%)",
          }}
        >
          <span
            className="absolute inset-0"
            style={{ background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.09) 46%, transparent 58%)" }}
          />
          <span
            className="absolute text-white/80"
            style={{ left: 5.5 * scale, top: 4.2 * scale, fontSize: 4.2 * scale, letterSpacing: "-0.03em", fontWeight: 500 }}
          >
            mora
          </span>
          <span
            className="absolute rounded-full border border-white/35"
            style={{ right: 5.5 * scale, top: 4.4 * scale, width: 4.6 * scale, height: 4.6 * scale }}
          />
        </div>

        {/* Marca fija de la esquina. */}
        <span className="absolute w-px bg-[var(--mdr-ink)]" style={{ left: x0 - 1, top: 0, bottom: 0 }} />
        <span className="absolute h-px bg-[var(--mdr-ink)]" style={{ left: 0, right: 0, top: y0 - 1 }} />
        <span className="absolute text-[11.5px] tracking-[-0.01em] text-[var(--mdr-ink)]" style={{ left: x0 + 9, top: y0 - 22 }}>
          Esquina aquí
        </span>

        {/* Borde que se mueve. */}
        <span className="absolute w-[1.5px] bg-[var(--mdr-accent)]" style={{ left: x0 + width - 0.75, top: 0, bottom: 0 }} />
{/* La línea también se arrastra directo (toda su altura), no solo con la regla de abajo. */}
        <div
          className="pointer-events-auto absolute bottom-0 top-0 w-11 cursor-ew-resize"
          style={{ left: x0 + width - 22, touchAction: "none" }}
          onPointerDown={(event) => {
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // Puntero ya soltado: no hay arrastre que seguir.
            }
            edge.current = { x: event.clientX, from: scale };
          }}
          onPointerMove={(event) => {
            if (!edge.current) return;
            const next = edge.current.from + (event.clientX - edge.current.x) / CARD_WIDTH_MM;
            setValue(Number(Math.min(limit, Math.max(SCALE_MIN, next)).toFixed(2)));
          }}
          onPointerUp={() => (edge.current = null)}
          onPointerCancel={() => (edge.current = null)}
        >
          <span
            className="absolute left-1/2 flex h-[26px] w-[26px] -translate-x-1/2 items-center justify-center rounded-full border border-[var(--mdr-accent)] bg-white text-[var(--mdr-accent)]"
            style={{ top: y0 - 14 }}
          >
            <svg width="14" height="8" viewBox="0 0 14 8" aria-hidden>
              <path d="M4 1 1 4l3 3M10 1l3 3-3 3M1.5 4h11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>

      <div className="mdr-in mdr-hair-t flex-none px-5 pb-4 pt-3">
        <div className="flex items-end gap-3">
          <StepButton sign={-1} label="Más angosta" onPress={() => nudge(-0.01)} />
          <Dial
            value={scale}
            min={SCALE_MIN}
            max={limit}
            step={0.01}
            decimals={2}
            gap={5}
            label="Ancho de la tarjeta en pantalla"
            valueText={`${Math.round(width)} píxeles`}
            onChange={setValue}
          />
          <StepButton sign={1} label="Más ancha" onPress={() => nudge(0.01)} />
        </div>
        <button type="button" className="mdr-btn mt-4" onClick={() => onDone(scale)}>
          Coincide, continuar
        </button>
      </div>
    </>
  );
}

/* ───────────────────────── Medir ───────────────────────── */

function Stage({
  diameter,
  pxPerMm,
  exact,
  hint,
}: {
  diameter: number;
  pxPerMm: number;
  exact: string;
  hint: boolean;
}) {
  const r = (diameter / 2) * pxPerMm;
  const band = BAND_MM * pxPerMm;
  const outer = r + band;
  const reach = outer + 44;

  return (
    <div className="pointer-events-none relative min-h-0 flex-1 overflow-hidden" aria-hidden>
      <svg className="absolute left-1/2 top-1/2 overflow-visible" width="1" height="1">
        <defs>
          <radialGradient id="mdr-disc" cx="42%" cy="34%" r="80%">
            <stop offset="0%" stopColor="#8779d0" />
            <stop offset="100%" stopColor="#6658b2" />
          </radialGradient>
          <linearGradient id="mdr-axis-x" gradientUnits="userSpaceOnUse" x1={-reach} y1="0" x2={reach} y2="0">
            <stop offset="0" stopColor="#1d1d1f" stopOpacity="0" />
            <stop offset="0.3" stopColor="#1d1d1f" stopOpacity="0.2" />
            <stop offset="0.7" stopColor="#1d1d1f" stopOpacity="0.2" />
            <stop offset="1" stopColor="#1d1d1f" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mdr-axis-y" gradientUnits="userSpaceOnUse" x1="0" y1={-reach} x2="0" y2={reach}>
            <stop offset="0" stopColor="#1d1d1f" stopOpacity="0" />
            <stop offset="0.3" stopColor="#1d1d1f" stopOpacity="0.2" />
            <stop offset="0.7" stopColor="#1d1d1f" stopOpacity="0.2" />
            <stop offset="1" stopColor="#1d1d1f" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Mira para centrar el anillo. El 0.01 evita que el degradado se anule en una línea sin alto. */}
        <path d={`M${-reach} 0L${reach} 0.01`} stroke="url(#mdr-axis-x)" strokeWidth="1" />
        <path d={`M0 ${-reach}L0.01 ${reach}`} stroke="url(#mdr-axis-y)" strokeWidth="1" />

        {/* Dónde va el aro. */}
        <g className={hint ? "mdr-ghost" : undefined}>
          <circle r={r + band / 2} fill="none" stroke="rgba(29,29,31,0.035)" strokeWidth={band} />
          <circle r={r + band} fill="none" stroke="rgba(29,29,31,0.22)" strokeWidth="1" strokeDasharray="1.5 4" />
        </g>

        {exact ? <circle key={exact} className="mdr-ripple" r={r} fill="none" stroke="#6f61b8" strokeWidth="1.5" /> : null}

        {/* El borde exterior del disco es la medida: el trazo oscuro va por dentro de ese borde. */}
        <circle r={r} fill="url(#mdr-disc)" />
        <circle r={Math.max(0, r - 0.5)} fill="none" stroke="#3f357d" strokeWidth="1" />

        <path d="M-4.5 0H4.5M0 -4.5V4.5" stroke="rgba(255,255,255,0.85)" strokeWidth="1" strokeLinecap="round" />
        <text
          y={r * 0.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          style={{ fontSize: Math.min(18, r * 0.32), fontWeight: 600, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}
        >
          {mm(diameter)}
          <tspan dx="3" style={{ fontSize: Math.min(12, r * 0.22), fontWeight: 400, opacity: 0.85 }}>
            mm
          </tspan>
        </text>
      </svg>

      {hint ? (
        <p
          className="mdr-bob absolute left-1/2 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3.5 py-[7px] text-[12.5px] tracking-[-0.01em] text-[var(--mdr-ink)] shadow-[0_8px_24px_-12px_rgba(29,29,31,0.35),0_0_0_1px_rgba(29,29,31,0.07)]"
          style={{ top: `calc(50% - ${outer + 52}px)` }}
        >
          Pon tu anillo sobre el círculo
          <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
            <path d="M4.5 1v8M1.5 6 4.5 9l3-3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </p>
      ) : null}
    </div>
  );
}

function Picto({ disc, label, good }: { disc: number; label: string; good?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <div
        className={`flex w-full justify-center rounded-[18px] py-2.5 ${
          good ? "bg-white shadow-[0_0_0_1px_var(--mdr-ink)]" : "bg-[#f5f5f7]"
        }`}
      >
        <svg width="62" height="62" viewBox="-31 -31 62 62" aria-hidden>
          <MetalDefs />
          <circle r={disc} fill="#6f61b8" />
          <circle r="20.5" fill="none" stroke="url(#mdr-metal)" strokeWidth="5" />
          <circle r="23" fill="none" stroke="rgba(29,29,31,0.28)" strokeWidth="0.6" />
          <circle r="18" fill="none" stroke="rgba(29,29,31,0.28)" strokeWidth="0.6" />
        </svg>
      </div>
      <p className={`mt-2 text-[12.5px] tracking-[-0.01em] ${good ? "text-[var(--mdr-ink)]" : "text-[var(--mdr-faint)]"}`}>
        {label}
      </p>
    </div>
  );
}

function HelpSheet({ onClose }: { onClose: () => void }) {
  const tips = [
    "Usa un anillo que te quede bien en el dedo índice: ahí va Mora.",
    "Ponlo plano sobre el círculo y míralo de frente, desde arriba.",
    "Agranda el círculo hasta que no quede espacio claro entre el lila y el metal.",
  ];
  return (
    <div className="mdr-fade mdr-dim absolute inset-0 z-10 flex items-end justify-center p-3 sm:items-center">
      <div className="mdr-sheet w-full max-w-[440px] rounded-[30px] px-6 pb-5 pt-7" role="dialog" aria-label="Cómo medir">
        <p className="mdr-caps">Cómo medir</p>
        <h2 className="mdr-title mt-2 text-[26px]">Llena el hueco de tu anillo</h2>
        <div className="mt-5 flex gap-2">
          <Picto disc={11} label="Falta" />
          <Picto disc={18} label="Justo" good />
          <Picto disc={27} label="Se pasó" />
        </div>
        <ol className="mt-5">
          {tips.map((tip, index) => (
            <li
              key={tip}
              className={`flex gap-4 py-3 text-[14px] leading-[1.4] tracking-[-0.012em] ${index ? "mdr-hair-t" : ""}`}
            >
              <span className="w-3 flex-none pt-[1px] text-[12px] tabular-nums text-[var(--mdr-faint)]">{index + 1}</span>
              {tip}
            </li>
          ))}
        </ol>
        <button type="button" className="mdr-btn mt-3" onClick={onClose}>
          Empezar
        </button>
      </div>
    </div>
  );
}

function ResultSheet({
  row,
  action,
  onAccept,
  onBack,
}: {
  row: RingSizeRow;
  action: string;
  onAccept: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mdr-fade mdr-dim absolute inset-0 z-10 flex items-center justify-center p-4">
      <div className="mdr-sheet w-full max-w-[400px] rounded-[32px] px-7 pb-4 pt-9 text-center" role="dialog" aria-label="Tu talla">
        <div className="relative mx-auto h-[168px] w-[168px]">
          <svg viewBox="0 0 168 168" className="absolute inset-0 -rotate-90" aria-hidden>
            <MetalDefs />
            <circle cx="84" cy="84" r="76" fill="none" stroke="#f0f0f3" strokeWidth="11" />
            <circle className="mdr-draw" cx="84" cy="84" r="76" fill="none" stroke="url(#mdr-metal)" strokeWidth="11" pathLength={1} />
            <circle cx="84" cy="84" r="81.5" fill="none" stroke="rgba(29,29,31,0.16)" strokeWidth="0.75" />
            <circle cx="84" cy="84" r="70.5" fill="none" stroke="rgba(29,29,31,0.16)" strokeWidth="0.75" />
          </svg>
          <p className="mdr-numeral absolute inset-0 flex items-center justify-center text-[84px]">
            <span className="mdr-pop inline-block" style={{ animationDelay: "0.35s" }}>
              {row.size}
            </span>
          </p>
        </div>
        <p className="mdr-caps mt-7">Tu talla Mora</p>
        <h2 className="mdr-title mt-2 text-[28px]">Talla {row.size}</h2>
        <dl className="mdr-hair-t mt-6 flex pt-4">
          <div className="flex-1">
            <dt className="mdr-caps">Por dentro</dt>
            <dd className="mt-1 text-[16px] tabular-nums tracking-[-0.02em]">{diameterLabel(row)}</dd>
          </div>
          <div className="flex-1 border-l border-[var(--mdr-hair)]">
            <dt className="mdr-caps">Contorno</dt>
            <dd className="mt-1 text-[16px] tabular-nums tracking-[-0.02em]">{aroundLabel(row)}</dd>
          </div>
        </dl>
        <button type="button" className="mdr-btn mt-6" onClick={onAccept}>
          {action}
        </button>
        <button type="button" className="mdr-ghost-btn mt-1.5 !h-11 w-full" onClick={onBack}>
          Volver a medir
        </button>
      </div>
    </div>
  );
}

function Measure({
  pxPerMm,
  onRecalibrate,
  onClose,
  onPick,
}: {
  pxPerMm: number;
  /** Sin esto no se ofrece ajustar la pantalla (equipo reconocido: no hay nada que calibrar). */
  onRecalibrate?: () => void;
  onClose?: () => void;
  onPick?: (size: number) => void;
}) {
  const router = useRouter();
  const [diameter, setDiameter] = useState(D_START);
  const [touched, setTouched] = useState(false);
  // Solo se monta en el navegador (tras calibrar), así que puede leer el almacenamiento al nacer.
  const [help, setHelp] = useState(() => {
    try {
      return !window.localStorage.getItem(HELP_KEY);
    } catch {
      return true;
    }
  });
  const [done, setDone] = useState(false);
  const glide = useRef(0);
  // Antes de mover nada no hay lectura: el círculo de arranque no es la talla de nadie.
  const reading: Reading = touched
    ? readDiameter(diameter)
    : {
        big: "–",
        row: null,
        exact: false,
        title: "Desliza la regla",
        note: "Hasta que el círculo llene justo el hueco de tu anillo.",
      };
  const matched = reading.exact ? reading.big : "";

  useEffect(() => () => cancelAnimationFrame(glide.current), []);

  // Toque corto al caer en una talla (donde el equipo vibra).
  useEffect(() => {
    if (matched && touched) navigator.vibrate?.(8);
  }, [matched, touched]);

  const closeHelp = () => {
    setHelp(false);
    try {
      window.localStorage.setItem(HELP_KEY, "1");
    } catch {
      // Sin almacenamiento: la guía vuelve a salir la próxima vez.
    }
  };

  const move = (next: number) => {
    cancelAnimationFrame(glide.current);
    setTouched(true);
    setDiameter(next);
  };

  const nudge = (by: number) => move(Number(Math.min(D_MAX, Math.max(D_MIN, diameter + by)).toFixed(1)));

  const glideTo = (target: number) => {
    cancelAnimationFrame(glide.current);
    setTouched(true);
    const from = diameter;
    let started = 0;
    const frame = (now: number) => {
      started ||= now;
      const progress = Math.min(1, (now - started) / 460);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDiameter(progress === 1 ? target : Number((from + (target - from) * eased).toFixed(2)));
      if (progress < 1) glide.current = requestAnimationFrame(frame);
    };
    glide.current = requestAnimationFrame(frame);
  };

  const accept = (size: number) => {
    if (onPick) {
      onPick(size);
      return;
    }
    // Página suelta: deja la talla elegida en la tienda y lleva al anillo que se estaba viendo.
    const store = useMoraStore.getState();
    store.setSize(size);
    router.push(productPath(store.selection.modelId));
  };

  return (
    <>
      <TopBar
        onClose={onClose}
        action={
          <>
            {onRecalibrate ? (
              <button type="button" aria-label="Ajustar pantalla" className="mdr-ghost-btn w-9" onClick={onRecalibrate}>
                <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden>
                  <path d="M2 11.5 11.5 2l3.5 3.5L5.5 15 2 11.5Z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                  <path d="m4.6 9 1.6 1.6M6.9 6.7l1.6 1.6M9.2 4.4l1.6 1.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
            <button type="button" aria-label="Cómo medir" className="mdr-ghost-btn w-9" onClick={() => setHelp(true)}>
              <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden>
                <circle cx="8.5" cy="8.5" r="7" fill="none" stroke="currentColor" strokeWidth="1.1" />
                <path d="M6.6 6.7a1.9 1.9 0 1 1 2.7 1.7c-.5.3-.8.7-.8 1.3" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <circle cx="8.5" cy="11.9" r="0.7" fill="currentColor" />
              </svg>
            </button>
          </>
        }
      />

      <Stage diameter={diameter} pxPerMm={pxPerMm} exact={matched} hint={!touched} />

      <div className="mdr-in flex-none px-5 pb-4">
        <div className="mdr-hair-t flex items-center gap-5 pb-3.5 pt-4" aria-live="polite">
          <div className="w-[84px] flex-none text-center">
            <p className="mdr-caps">Talla</p>
            <p className="mdr-numeral mt-1.5 text-[64px]">
              <span key={reading.big} className={`mdr-pop inline-block ${touched ? "" : "text-[#d2d2d7]"}`}>
                {reading.big}
              </span>
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[15px] font-medium tracking-[-0.018em]">
              {reading.exact ? (
                <svg key={reading.big} width="15" height="15" viewBox="0 0 15 15" className="mdr-pop flex-none" aria-hidden>
                  <circle cx="7.5" cy="7.5" r="7.5" fill="var(--mdr-accent)" />
                  <path d="M4.3 7.7 6.6 9.9 10.8 5.4" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
              {reading.title}
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.4] text-[var(--mdr-gray)]">{reading.note}</p>
          </div>
        </div>

        <div className="mdr-hair-t flex pt-1" role="group" aria-label="Probar una talla">
          {RING_SIZES.map((row) => {
            const on = reading.row?.size === row.size;
            return (
              <button
                key={row.size}
                type="button"
                aria-pressed={on}
                aria-label={`Talla ${row.size}, ${diameterLabel(row)}`}
                onClick={() => glideTo(row.diameterMm)}
                className={`relative h-10 flex-1 text-[15px] tabular-nums tracking-[-0.02em] transition-colors duration-200 ${
                  on ? "font-semibold text-[var(--mdr-ink)]" : "text-[var(--mdr-faint)]"
                }`}
              >
                {row.size}
                <span
                  className={`absolute bottom-[3px] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-[var(--mdr-accent)] transition-opacity duration-200 ${
                    on ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-end gap-3">
          <StepButton sign={-1} label="Círculo más pequeño" onPress={() => nudge(-0.1)} />
          <Dial
            value={Number(diameter.toFixed(1))}
            min={D_MIN}
            max={D_MAX}
            step={0.1}
            decimals={1}
            gap={11}
            marks={RING_SIZES.map((row) => ({
              at: row.diameterMm,
              label: String(row.size),
              on: reading.exact && reading.row?.size === row.size,
            }))}
            label="Diámetro del círculo"
            valueText={`${mm(diameter)} milímetros. ${reading.title}`}
            onChange={move}
          />
          <StepButton sign={1} label="Círculo más grande" onPress={() => nudge(0.1)} />
        </div>

        <button type="button" className="mdr-btn mt-4" disabled={!reading.row} onClick={() => setDone(true)}>
          {!touched ? "Desliza para medir" : reading.row ? `Esta es mi talla · ${reading.row.size}` : "Fuera de nuestras tallas"}
        </button>
      </div>

      {help ? <HelpSheet onClose={closeHelp} /> : null}
      {done && reading.row ? (
        <ResultSheet
          row={reading.row}
          action={onPick ? `Usar talla ${reading.row.size}` : "Elegir mi anillo"}
          onAccept={() => accept(reading.row!.size)}
          onBack={() => setDone(false)}
        />
      ) : null}
    </>
  );
}

/* ───────────────────────── Página ───────────────────────── */

/**
 * Medidor a pantalla completa. Suelto en `/medidor`, o encima del detalle de producto:
 * ahí `onClose` lo cierra y `onPick` devuelve la talla al selector.
 */
export function RingSizer({ onClose, onPick }: { onClose?: () => void; onPick?: (size: number) => void }) {
  // La escala depende de la pantalla: nada se dibuja en el servidor, ni antes de saber si el
  // equipo se reconoce (en Android hay que preguntar el modelo).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void resolveKnownPxPerMm().finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Encima de otra página, lo de atrás no debe moverse mientras se mide.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  return (
    <div className={`mdr-root fixed inset-0 z-[1000] flex justify-center overflow-hidden ${onClose ? "mdr-rise" : ""}`}>
      <div
        className="relative flex h-full w-full max-w-[480px] flex-col"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {ready ? <Session onClose={onClose} onPick={onPick} /> : null}
      </div>
    </div>
  );
}

function Session({ onClose, onPick }: { onClose?: () => void; onPick?: (size: number) => void }) {
  // Lo calibrado a mano manda; si no hay, un iPhone reconocido ya trae su medida exacta.
  const [calibrated] = useState(loadScale);
  const [known] = useState(knownPxPerMm);
  const saved = calibrated ?? known;
  // Pantalla reconocida y sin ajuste manual: la regla de arriba sobra.
  const [manual, setManual] = useState(calibrated !== null || known === null);
  const [phase, setPhase] = useState<"calibrate" | "measure">(saved ? "measure" : "calibrate");
  const [pxPerMm, setPxPerMm] = useState(() => saved ?? guessPxPerMm());
  const [zoomChanged, setZoomChanged] = useState(false);
  const zoom = useRef(1);

  useEffect(() => {
    zoom.current = currentZoom();

    // El zoom del navegador cambia el tamaño real de cada px: la calibración deja de valer.
    const onResize = () => {
      const now = currentZoom();
      if (Math.abs(now - zoom.current) < 0.01) return;
      setPxPerMm((value) => (value * now) / zoom.current);
      zoom.current = now;
      setZoomChanged(true);
      setPhase("calibrate");
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Pantalla encendida mientras se mide.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const hold = async () => {
      try {
        if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
        const next = await navigator.wakeLock.request("screen");
        if (gone) void next.release();
        else lock = next;
      } catch {
        // Batería baja o sin permiso: se mide igual.
      }
    };
    void hold();
    document.addEventListener("visibilitychange", hold);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", hold);
      void lock?.release();
    };
  }, []);

  return phase === "calibrate" ? (
    <Calibrate
      key={pxPerMm}
      initial={pxPerMm}
      zoomChanged={zoomChanged}
      onClose={onClose}
      onDone={(value) => {
        saveScale(value);
        zoom.current = currentZoom();
        setPxPerMm(value);
        setZoomChanged(false);
        setManual(true);
        setPhase("measure");
      }}
    />
  ) : (
    <Measure pxPerMm={pxPerMm} onRecalibrate={manual ? () => setPhase("calibrate") : undefined} onClose={onClose} onPick={onPick} />
  );
}
