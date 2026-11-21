"use client";

import type { CSSProperties } from "react";
import { promoClockTime, promoMoment, type ActivePromo } from "@/commerce/promos";
import { usePromoState } from "@/components/sales/SalesProvider";
import { insightPromo } from "@/insights/client";
import { PromoFigure } from "./PromoFigure";
import { PromoHangTag } from "./PromoLogo";
import { RollNumber, splitTime, spokenTime, two, useRemaining, type TimeParts } from "./PromoClock";
import "./promo.css";

type Group = { value: string; unit: string };

function groupsOf(parts: TimeParts): Group[] {
  const tail: Group[] = [
    { value: two(parts.mins), unit: "min" },
    { value: two(parts.secs), unit: "seg" },
  ];
  if (parts.days > 0) {
    return [
      { value: two(parts.days), unit: parts.days === 1 ? "día" : "días" },
      { value: two(parts.hours), unit: "horas" },
      ...tail,
    ];
  }
  if (parts.hours > 0) return [{ value: two(parts.hours), unit: parts.hours === 1 ? "hora" : "horas" }, ...tail];
  return tail;
}

function lasts(promo: ActivePromo) {
  const minutes = Math.round((promo.endsAt - promo.startsAt) / 60_000);
  if (minutes === 60) return "una hora";
  if (minutes === 120) return "dos horas";
  return `${minutes} minutos`;
}

/**
 * El momento de la promoción en el inicio: negro, la etiqueta colgante con el logotipo,
 * el descuento ardiendo en polvo lila y el reloj.
 * `top` es la primera pantalla cuando ya está en vivo; `teaser` va tras el anillo mientras se anuncia.
 * `initial` es lo que pintó el servidor: evita que la página salte al cargar.
 */
export function PromoStage({
  slot,
  initial,
}: {
  slot: "top" | "teaser";
  initial: ActivePromo | null;
}) {
  const state = usePromoState();
  const promo = state.loaded ? state.promo : initial;
  if (!promo || promo.phase !== (slot === "top" ? "live" : "teaser")) return null;
  return <Stage key={promo.key} promo={promo} />;
}

function Stage({ promo }: { promo: ActivePromo }) {
  const live = promo.phase === "live";
  const hora = promo.kind === "hora_loca";
  const target = live ? promo.endsAt : promo.startsAt;
  const left = useRemaining(target);
  const parts = left == null ? null : splitTime(left);
  const groups = parts
    ? groupsOf(parts)
    : (hora ? ["min", "seg"] : ["días", "horas", "min", "seg"]).map((unit) => ({ value: "00", unit }));

  const span = live ? promo.endsAt - promo.startsAt : promo.startsAt - promo.teaserAt;
  const remaining = left == null || span <= 0 ? 1 : Math.min(1, Math.max(0, left / span));

  const until = live
    ? hora
      ? `Solo hasta las ${promoClockTime(promo.endsAt)}`
      : `Hasta el ${promoMoment(promo.endsAt)}`
    : hora
      ? `Empieza a las ${promoClockTime(promo.startsAt)} y dura ${lasts(promo)}`
      : `Empieza el ${promoMoment(promo.startsAt)}`;

  const track = () => {
    if (live && !promo.preview) insightPromo("cta", promo);
  };

  return (
    <section
      className="promo-stage"
      data-promo-stage={live ? "top" : "teaser"}
      data-kind={promo.kind}
      data-phase={promo.phase}
      data-ready={parts ? "" : undefined}
      aria-label={`${promo.label}: ${promo.percent} % de descuento en toda la tienda`}
    >
      <div className="promo-stage-body">
        <div className="promo-rise" style={{ "--i": 0 } as CSSProperties}>
          <PromoHangTag label={promo.label} swing />
        </div>
        <div className="promo-figure-wrap promo-rise" style={{ "--i": 1 } as CSSProperties}>
          <PromoFigure percent={promo.percent} />
        </div>

        <div className="promo-clock promo-rise" style={{ "--i": 2 } as CSSProperties}>
          <div
            className="promo-count"
            role="timer"
            aria-label={parts ? `${live ? "Termina" : "Empieza"} en ${spokenTime(parts)}` : undefined}
            style={{ "--groups": groups.length } as CSSProperties}
          >
            {groups.map((group, index) => (
              <div key={groups.length - index} className="promo-group">
                <RollNumber value={group.value} />
                <span className="promo-unit" aria-hidden>
                  {group.unit}
                </span>
              </div>
            ))}
          </div>
          <div className="promo-drain" aria-hidden>
            <span style={{ transform: `scaleX(${remaining})` }} />
          </div>
        </div>

        <p className="promo-until promo-rise" style={{ "--i": 3 } as CSSProperties} suppressHydrationWarning>
          {until}
        </p>

        <div className="promo-rise" style={{ "--i": 5 } as CSSProperties}>
          <a href="#coleccion" className="promo-cta" onClick={track}>
            {live ? "Elegir mi Mora" : "Ver la colección"}
            <span aria-hidden className="promo-cta-arrow">
              ›
            </span>
          </a>
          {live ? <p className="promo-fine">El descuento ya viene aplicado al pagar.</p> : null}
        </div>
      </div>
    </section>
  );
}
