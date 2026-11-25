"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ModelId } from "@/lib/catalog";
import { featureStory, type FeatureId } from "@/lib/featureStories";
import { specHighlights, specSheet, type SpecIconId } from "@/lib/productSpec";
import { useHorizontalSwipe } from "@/lib/useHorizontalSwipe";
import { SpecIcon } from "./SpecIcon";

export type FeatureTab = FeatureId | "more";

const TABS: { id: FeatureTab; icon: SpecIconId | null; label: string }[] = [
  ...specHighlights.map((item) => ({ id: item.icon as FeatureId, icon: item.icon, label: item.label })),
  { id: "more", icon: null, label: "Más" },
];

const LEAVE_MS = 260;

/**
 * Hoja de una lectura: sube desde abajo en celular y aparece al centro en PC.
 * Arriba un control con las cinco pestañas; también se pasa de una a otra deslizando de lado.
 */
export function FeatureSheet({
  modelId,
  tab,
  onTab,
  onClose,
}: {
  modelId: ModelId;
  tab: FeatureTab;
  onTab: (tab: FeatureTab) => void;
  onClose: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const index = TABS.findIndex((item) => item.id === tab);

  function close() {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onClose, LEAVE_MS);
  }

  const swipe = useHorizontalSwipe(
    () => index > 0 && onTab(TABS[index - 1].id),
    () => index < TABS.length - 1 && onTab(TABS[index + 1].id),
  );

  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      root.style.overflow = before;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight" && index < TABS.length - 1) onTab(TABS[index + 1].id);
      if (event.key === "ArrowLeft" && index > 0) onTab(TABS[index - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const title = tab === "more" ? "Y además" : featureStory(modelId, tab).title;

  return createPortal(
    <div className={`fs-root ${leaving ? "fs-leaving" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="fs-dim" aria-label="Cerrar" tabIndex={-1} onClick={close} />
      <div className="fs-card">
        <div className="fs-bar">
          <div className="fs-tabs" role="tablist" aria-label="Lecturas">
            {TABS.map((item) => {
              const on = item.id === tab;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={item.label}
                  className={`fs-tab ${on ? "on" : ""}`}
                  onClick={() => onTab(item.id)}
                >
                  {item.icon ? (
                    <SpecIcon id={item.icon} />
                  ) : (
                    <svg viewBox="0 0 16 4" aria-hidden className="fs-dots">
                      <circle cx="2" cy="2" r="1.6" />
                      <circle cx="8" cy="2" r="1.6" />
                      <circle cx="14" cy="2" r="1.6" />
                    </svg>
                  )}
                  <span className="fs-tab-label">{item.label}</span>
                </button>
              );
            })}
          </div>
          <button ref={closeRef} type="button" className="fs-x" aria-label="Cerrar" onClick={close}>
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
              <path
                d="M3.2 3.2 10.8 10.8M10.8 3.2 3.2 10.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div key={tab} className="fs-body" role="tabpanel" {...swipe}>
          {tab === "more" ? <MorePanel modelId={modelId} /> : <StoryPanel modelId={modelId} id={tab} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StoryPanel({ modelId, id }: { modelId: ModelId; id: FeatureId }) {
  const story = featureStory(modelId, id);
  return (
    <>
      <h2 className="fs-title">{story.title}</h2>
      <p className="fs-lead">{story.lead}</p>
      {id === "night" ? <SleepHero /> : null}
      {id === "pulse" ? <PulseHero /> : null}
      {id === "stress" ? modelId === "aero" ? <StressDayHero /> : <StressSpotHero /> : null}
      {id === "movement" ? <MovementHero /> : null}
      {id === "cycle" ? <CycleHero /> : null}
      <p className="fs-text">{story.body}</p>
      <ul className="fs-points">
        {story.points.map((point) => (
          <li key={point}>
            <svg viewBox="0 0 16 16" aria-hidden>
              <path
                d="M3.5 8.4 6.6 11.4 12.5 4.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {point}
          </li>
        ))}
      </ul>
      <p className="fs-foot">{story.foot ?? "Es seguimiento de bienestar. No diagnostica ni reemplaza una consulta."}</p>
    </>
  );
}

const MORE_TINT: Partial<Record<SpecIconId, string>> = {
  recovery: "linear-gradient(145deg, #5ee0c5, #1fa391)",
  sport: "linear-gradient(145deg, #ffb35c, #ff7a2f)",
  skin: "linear-gradient(145deg, #ff9a8b, #f25f6b)",
  cycle: "linear-gradient(145deg, #ff9cc8, #e0559c)",
  meditation: "linear-gradient(145deg, #b5a6ff, #6f61b8)",
  bond: "linear-gradient(145deg, #7cc4ff, #4b7bec)",
};

function MorePanel({ modelId }: { modelId: ModelId }) {
  const shown = new Set<SpecIconId>(specHighlights.map((item) => item.icon));
  const rest = specSheet[modelId].readings.filter((item) => !shown.has(item.icon));
  const bond = rest.find((item) => item.icon === "bond");
  const tiles = rest.filter((item) => item.icon !== "bond");
  return (
    <>
      <h2 className="fs-title">Y además</h2>
      <p className="fs-lead">Todo lo que lee tu anillo, en la app Mora Ring.</p>
      {bond ? (
        <div className="fs-bond">
          <span className="fs-bond-orbit" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="fs-app-ico fs-app-ico-lg" style={{ background: MORE_TINT.bond }}>
            <SpecIcon id="bond" />
          </span>
          <p className="fs-bond-name">{bond.label}</p>
          <p className="fs-bond-desc">{bond.value}</p>
        </div>
      ) : null}
      <ul className="fs-apps">
        {tiles.map((item, i) => (
          <li
            key={item.label}
            className={tiles.length % 2 && i === tiles.length - 1 ? "fs-app-span" : ""}
            style={{ animationDelay: `${0.08 + i * 0.06}s` }}
          >
            <span className="fs-app-ico" style={{ background: MORE_TINT[item.icon] }}>
              <SpecIcon id={item.icon} />
            </span>
            <span className="fs-app-name">{item.label}</span>
            <span className="fs-app-desc">{item.value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Tarjetas gráficas: datos de muestra, dibujados al abrir ── */

function Hero({
  theme,
  kicker,
  big,
  unit,
  children,
  stats,
}: {
  theme: string;
  kicker: string;
  big?: string;
  unit?: string;
  children: ReactNode;
  stats?: { label: string; value: string }[];
}) {
  return (
    <div className="fs-hero" data-theme={theme}>
      <p className="fs-hero-kicker">{kicker}</p>
      {big ? (
        <p className="fs-hero-big">
          {big}
          {unit ? <span>{unit}</span> : null}
        </p>
      ) : null}
      {children}
      {stats ? (
        <dl className="fs-stats">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** Curva suave que pasa por todos los puntos (Catmull-Rom a Bézier). */
function smooth(points: [number, number][]) {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i - 1] ?? points[i];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[i + 2] ?? points[i + 1];
    d += ` C${x1 + (x2 - x0) / 6} ${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6} ${y2 - (y3 - y1) / 6} ${x2} ${y2}`;
  }
  return d;
}

function hm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

const SLEEP: { stage: 0 | 1 | 2 | 3; from: number; to: number }[] = [
  { stage: 0, from: 0, to: 2 },
  { stage: 2, from: 2, to: 12 },
  { stage: 3, from: 12, to: 26 },
  { stage: 2, from: 26, to: 34 },
  { stage: 1, from: 34, to: 41 },
  { stage: 2, from: 41, to: 50 },
  { stage: 3, from: 50, to: 58 },
  { stage: 2, from: 58, to: 66 },
  { stage: 1, from: 66, to: 74 },
  { stage: 0, from: 74, to: 75 },
  { stage: 2, from: 75, to: 86 },
  { stage: 1, from: 86, to: 98 },
  { stage: 0, from: 98, to: 100 },
];
const STAGES = [
  { name: "Despierto", color: "#ffbf73" },
  { name: "REM", color: "#7fd3ff" },
  { name: "Ligero", color: "#a194ff" },
  { name: "Profundo", color: "#6a4dff" },
];
const IN_BED = 490;

function SleepHero() {
  const share = [0, 1, 2, 3].map((stage) =>
    SLEEP.filter((seg) => seg.stage === stage).reduce((sum, seg) => sum + seg.to - seg.from, 0),
  );
  const asleep = (IN_BED * (100 - share[0])) / 100;
  const x0 = 52;
  const w = 268;
  const rowY = (stage: number) => stage * 20 + 12;
  return (
    <Hero theme="night" kicker="Anoche" big={hm(asleep)} unit="dormido">
      <span className="fs-stars" aria-hidden>
        {[12, 28, 46, 63, 81, 92].map((x, i) => (
          <i key={x} style={{ left: `${x}%`, top: `${8 + ((i * 37) % 22)}%`, animationDelay: `${i * 0.6}s` }} />
        ))}
      </span>
      <svg viewBox="0 0 320 84" className="fs-chart fs-glow-night" aria-hidden>
        {STAGES.map((stage, i) => (
          <g key={stage.name}>
            <text x="0" y={rowY(i) + 3}>
              {stage.name}
            </text>
            <line x1={x0} x2="320" y1={rowY(i)} y2={rowY(i)} className="fs-grid" />
          </g>
        ))}
        {SLEEP.slice(1).map((seg, i) => (
          <line
            key={`j${i}`}
            x1={x0 + (seg.from * w) / 100}
            x2={x0 + (seg.from * w) / 100}
            y1={rowY(SLEEP[i].stage)}
            y2={rowY(seg.stage)}
            className="fs-join"
            style={{ animationDelay: `${0.25 + i * 0.05}s` }}
          />
        ))}
        {SLEEP.map((seg, i) => (
          <rect
            key={i}
            className="fs-bar-in"
            x={x0 + (seg.from * w) / 100}
            y={rowY(seg.stage) - 6}
            width={Math.max(3, ((seg.to - seg.from) * w) / 100)}
            height="12"
            rx="4"
            fill={STAGES[seg.stage].color}
            style={{ animationDelay: `${0.1 + i * 0.05}s` }}
          />
        ))}
      </svg>
      <div className="fs-axis fs-axis-indent">
        <span>11:12 p. m.</span>
        <span>7:22 a. m.</span>
      </div>
      <div className="fs-stack" aria-hidden>
        {[3, 2, 1, 0].map((stage) => (
          <i key={stage} style={{ flexGrow: share[stage], background: STAGES[stage].color }} />
        ))}
      </div>
      <dl className="fs-legend-grid">
        {[3, 2, 1, 0].map((stage) => (
          <div key={stage}>
            <dt>
              <i style={{ background: STAGES[stage].color }} />
              {STAGES[stage].name}
            </dt>
            <dd>{hm((IN_BED * share[stage]) / 100)}</dd>
          </div>
        ))}
      </dl>
    </Hero>
  );
}

const HOURS: [number, number][] = [
  [54, 60], [52, 58], [52, 57], [53, 59], [54, 61], [56, 66], [60, 78], [64, 84],
  [66, 88], [64, 82], [63, 80], [65, 86], [68, 90], [64, 84], [62, 80], [63, 82],
  [66, 88], [70, 95], [92, 112], [78, 100], [68, 86], [64, 78], [60, 72], [56, 66],
];

function PulseHero() {
  const beat = "l16 0 4-8 5 20 5-34 5 26 4-6 11 0";
  const strip = `M0 34 ${Array.from({ length: 12 }, () => beat).join(" ")}`;
  const y = (bpm: number) => 70 - ((bpm - 45) / 75) * 64;
  return (
    <Hero
      theme="pulse"
      kicker="En reposo"
      big="62"
      unit="lpm"
      stats={[
        { label: "Mínimo", value: "52" },
        { label: "Promedio", value: "68" },
        { label: "Máximo", value: "112" },
      ]}
    >
      <span className="fs-heart" aria-hidden>
        <SpecIcon id="pulse" />
      </span>
      <div className="fs-ecg" aria-hidden>
        <svg viewBox="0 0 300 60" preserveAspectRatio="none">
          <g className="fs-ecg-run">
            <path d={strip} />
          </g>
        </svg>
      </div>
      <svg viewBox="0 0 300 76" className="fs-chart fs-glow-pulse" aria-hidden>
        {[60, 90].map((bpm) => (
          <g key={bpm}>
            <line x1="0" x2="300" y1={y(bpm)} y2={y(bpm)} className="fs-grid" />
            <text x="300" y={y(bpm) - 3} textAnchor="end">
              {bpm}
            </text>
          </g>
        ))}
        {HOURS.map(([lo, hi], i) => (
          <rect
            key={i}
            className="fs-rise"
            x={i * 11.5 + 1}
            y={y(hi)}
            width="6"
            height={y(lo) - y(hi)}
            rx="3.25"
            fill={hi > 100 ? "#ffd1dc" : "url(#fs-hr)"}
            style={{ animationDelay: `${0.15 + i * 0.025}s` }}
          />
        ))}
        <defs>
          <linearGradient id="fs-hr" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ff8aa5" />
            <stop offset="1" stopColor="#ff4d78" />
          </linearGradient>
        </defs>
      </svg>
      <div className="fs-axis fs-axis-pulse">
        <span>0 h</span>
        <span>6 h</span>
        <span>12 h</span>
        <span>18 h</span>
        <span>24 h</span>
      </div>
    </Hero>
  );
}

const STRESS = [22, 30, 45, 52, 38, 30, 42, 60, 74, 55, 40, 35, 48, 62, 45, 30, 26];

function StressDayHero() {
  const pts = STRESS.map((v, i) => [36 + (i * 264) / (STRESS.length - 1), 80 - v * 0.8] as [number, number]);
  const line = smooth(pts);
  const last = pts[pts.length - 1];
  return (
    <Hero theme="stress" kicker="Hoy" big="Calma" unit="la mayor parte del día">
      <svg viewBox="0 0 300 84" className="fs-chart fs-glow-stress" aria-hidden>
        <defs>
          <linearGradient id="fs-st" x1="0" x2="0" y1="0" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffb340" />
            <stop offset="0.45" stopColor="#b8a9ff" />
            <stop offset="1" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id="fs-st-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#b8a9ff" stopOpacity="0.32" />
            <stop offset="1" stopColor="#b8a9ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="36" x2="300" y1={80 - 66 * 0.8} y2={80 - 66 * 0.8} className="fs-grid fs-dash" />
        <text x="0" y={80 - 66 * 0.8 + 3}>
          Carga
        </text>
        <line x1="36" x2="300" y1={80 - 33 * 0.8} y2={80 - 33 * 0.8} className="fs-grid fs-dash" />
        <text x="0" y={80 - 33 * 0.8 + 3}>
          Calma
        </text>
        <path d={`${line} L300 84 L36 84 Z`} fill="url(#fs-st-fill)" className="fs-fade" />
        <path d={line} pathLength={1} className="fs-draw" stroke="url(#fs-st)" />
        <circle cx={last[0]} cy={last[1]} r="4" className="fs-now" />
      </svg>
      <div className="fs-axis fs-axis-stress">
        <span>6 a. m.</span>
        <span>Mediodía</span>
        <span>10 p. m.</span>
      </div>
      <div className="fs-stack" aria-hidden>
        <i style={{ flexGrow: 64, background: "#4ade80" }} />
        <i style={{ flexGrow: 26, background: "#b8a9ff" }} />
        <i style={{ flexGrow: 10, background: "#ffb340" }} />
      </div>
      <dl className="fs-legend-grid fs-legend-3">
        {[
          ["Calma", "64 %", "#4ade80"],
          ["Normal", "26 %", "#b8a9ff"],
          ["Carga", "10 %", "#ffb340"],
        ].map(([label, value, color]) => (
          <div key={label}>
            <dt>
              <i style={{ background: color }} />
              {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Hero>
  );
}

function StressSpotHero() {
  const value = 32;
  const angle = Math.PI * (1 - value / 100);
  const mx = 110 + 82 * Math.cos(angle);
  const my = 100 - 82 * Math.sin(angle);
  return (
    <Hero theme="stress" kicker="Medido a las 3:40 p. m.">
      <div className="fs-gauge">
        <svg viewBox="0 0 220 112" className="fs-glow-stress" aria-hidden>
          <defs>
            <linearGradient id="fs-gauge" x1="0" x2="1">
              <stop offset="0" stopColor="#4ade80" />
              <stop offset="0.5" stopColor="#b8a9ff" />
              <stop offset="1" stopColor="#ffb340" />
            </linearGradient>
          </defs>
          <path d="M28 100 A82 82 0 0 1 192 100" className="fs-gauge-track" />
          <path d="M28 100 A82 82 0 0 1 192 100" pathLength={1} className="fs-gauge-fill" stroke="url(#fs-gauge)" style={{ "--to": 1 - value / 100 } as CSSProperties} />
          <circle cx={mx} cy={my} r="7" className="fs-gauge-dot" />
        </svg>
        <div className="fs-gauge-num">
          <p>{value}</p>
          <span>Calma</span>
        </div>
      </div>
      <ul className="fs-reads">
        {[
          ["9:10 a. m.", "41"],
          ["1:25 p. m.", "58"],
          ["3:40 p. m.", "32"],
        ].map(([at, v], i) => (
          <li key={at} style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
            <span>{at}</span>
            <b>{v}</b>
          </li>
        ))}
      </ul>
    </Hero>
  );
}

const WEEK = [6200, 9100, 10400, 7300, 11800, 5400, 7840];

function MovementHero() {
  return (
    <Hero
      theme="move"
      kicker="Hoy"
      big="7.840"
      unit="pasos"
      stats={[
        { label: "Distancia", value: "5,6 km" },
        { label: "Energía", value: "312 kcal" },
        { label: "Meta", value: "10.000" },
      ]}
    >
      <svg viewBox="0 0 100 100" className="fs-ring fs-glow-move" aria-hidden>
        <defs>
          <linearGradient id="fs-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#ff7ab6" />
            <stop offset="1" stopColor="#8f7cff" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="40" className="fs-ring-track" />
        <circle cx="50" cy="50" r="40" pathLength={1} className="fs-ring-fill" stroke="url(#fs-ring)" />
      </svg>
      <div className="fs-week" aria-hidden>
        <span className="fs-goal" style={{ bottom: `calc(1.1rem + ${10000 / 12000} * (100% - 1.1rem))` }} />
        {WEEK.map((steps, i) => (
          <span key={i} className="fs-day">
            <i
              className={i === WEEK.length - 1 ? "on" : steps >= 10000 ? "hit" : ""}
              style={{ height: `${(steps / 12000) * 100}%`, animationDelay: `${0.2 + i * 0.06}s` }}
            />
            <b>{"LMMJVSD"[i]}</b>
          </span>
        ))}
      </div>
    </Hero>
  );
}

const CYCLE = { length: 28, today: 18, period: 5, fertile: [10, 15], ovulation: 14 };
/** Piel de cada noche hasta hoy, en °C. Sube al día siguiente de ovular y se queda arriba. */
const NIGHTS = [
  36.44, 36.37, 36.18, 36.22, 36.15, 36.2, 36.24, 36.17, 36.21, 36.14, 36.19, 36.23, 36.16, 36.12,
  36.47, 36.55, 36.51, 36.58,
];

function dayTone(day: number) {
  if (day <= CYCLE.period) return "period";
  if (day === CYCLE.ovulation) return "ovulation";
  if (day >= CYCLE.fertile[0] && day <= CYCLE.fertile[1]) return "fertile";
  return day < CYCLE.fertile[0] ? "before" : "after";
}

function CycleHero() {
  const dial = Array.from({ length: CYCLE.length }, (_, i) => {
    const day = i + 1;
    const angle = (i / CYCLE.length) * Math.PI * 2 - Math.PI / 2;
    return { day, x: 100 + 80 * Math.cos(angle), y: 100 + 80 * Math.sin(angle), tone: dayTone(day) };
  });
  const sweep = (CYCLE.today - 0.5) / CYCLE.length;
  const x = (day: number) => 6 + ((day - 1) * 288) / (CYCLE.length - 1);
  const y = (temp: number) => 66 - ((temp - 36.0) / 0.7) * 56;
  const low = NIGHTS.slice(2, 14).reduce((a, b) => a + b, 0) / 12;
  const high = NIGHTS.slice(14).reduce((a, b) => a + b, 0) / NIGHTS.slice(14).length;
  const mid = (low + high) / 2;
  const pts = NIGHTS.map((t, i) => [x(i + 1), y(t)] as [number, number]);
  return (
    <Hero
      theme="cycle"
      kicker="Hoy · Antes del periodo"
      stats={[
        { label: "Tu ciclo", value: "28 días" },
        { label: "Periodo", value: "5 días" },
        { label: "Días fértiles", value: "10 al 15" },
      ]}
    >
      <div className="fs-dial">
        <svg viewBox="0 0 200 200" aria-hidden>
          <circle cx="100" cy="100" r="80" className="fs-dial-track" />
          <circle
            cx="100"
            cy="100"
            r="80"
            pathLength={1}
            className="fs-dial-sweep"
            style={{ "--to": 1 - sweep } as CSSProperties}
          />
          {dial.map((dot) => (
            <circle
              key={dot.day}
              cx={dot.x}
              cy={dot.y}
              r={dot.tone === "ovulation" ? 7 : dot.day === CYCLE.today ? 6.5 : 4.6}
              className={`fs-dial-dot ${dot.day === CYCLE.today ? "today" : ""}`}
              data-tone={dot.tone}
              style={{ animationDelay: `${0.1 + dot.day * 0.025}s` }}
            />
          ))}
        </svg>
        <div className="fs-dial-core">
          <span>Día</span>
          <p>{CYCLE.today}</p>
          <b>Tu periodo en {CYCLE.length - CYCLE.today + 1} días</b>
        </div>
      </div>
      <ul className="fs-phases" aria-hidden>
        <li data-tone="period">Periodo</li>
        <li data-tone="fertile">Fértiles</li>
        <li data-tone="ovulation">Ovulación</li>
        <li data-tone="after">Antes del periodo</li>
      </ul>

      <div className="fs-temp">
        <div className="fs-temp-head">
          <p>Tu piel, cada noche</p>
          <span>+{(high - low).toFixed(1).replace(".", ",")} °C desde la ovulación</span>
        </div>
        <svg viewBox="0 0 300 80" className="fs-chart fs-glow-cycle" aria-hidden>
          <defs>
            <linearGradient id="fs-cy-high" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#c9bcff" stopOpacity="0.32" />
              <stop offset="1" stopColor="#c9bcff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect
            x={x(CYCLE.ovulation + 0.5)}
            y="0"
            width={x(CYCLE.today) + 8 - x(CYCLE.ovulation + 0.5)}
            height="72"
            rx="8"
            fill="url(#fs-cy-high)"
            className="fs-fade"
          />
          <line x1="0" x2="300" y1={y(mid)} y2={y(mid)} className="fs-grid fs-dash" />
          <line
            x1={x(CYCLE.ovulation)}
            x2={x(CYCLE.ovulation)}
            y1="2"
            y2="72"
            className="fs-ovu-line"
          />
          <line
            x1={x(CYCLE.today) + 8}
            x2={x(CYCLE.length)}
            y1={y(high)}
            y2={y(high)}
            className="fs-temp-ahead"
          />
          <path d={smooth(pts)} pathLength={1} className="fs-draw fs-temp-line" />
          {pts.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="2.6"
              className={`fs-temp-dot ${i + 1 > CYCLE.ovulation ? "high" : ""}`}
              style={{ animationDelay: `${0.25 + i * 0.06}s` }}
            />
          ))}
          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4.2" className="fs-now fs-now-cycle" />
        </svg>
        <div className="fs-axis fs-axis-cycle">
          <span>Día 1</span>
          <span className="fs-ovu-tag" style={{ left: `${(x(CYCLE.ovulation) / 300) * 100}%` }}>
            Ovulación estimada
          </span>
          <span>Día 28</span>
        </div>
      </div>
    </Hero>
  );
}
