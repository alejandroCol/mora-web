"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ActivePromo } from "@/commerce/promos";
import { usePromo } from "@/components/sales/SalesProvider";
import { insightPromo } from "@/insights/client";
import { splitTime, spokenTime, two, useRemaining, type TimeParts } from "./PromoClock";
import { PromoHangTag } from "./PromoLogo";
import "./promo.css";

const BAR_VAR = "--offer-bar";
const BAR_HEIGHT = "48px";

/** Dónde vive la franja: donde se elige y se paga. No en el pedido, soporte ni legales. */
function isStorePath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/anillo") ||
    pathname.startsWith("/case") ||
    pathname.startsWith("/checkout")
  );
}

/**
 * Franja negra de Black Friday / Hora Loca sobre el encabezado, con la cuenta regresiva.
 * En el inicio, mientras el escenario grande está arriba, se guarda (ya lo dice el escenario)
 * y el encabezado pasa a blanco para leerse sobre el negro.
 */
export function PromoChrome() {
  const promo = usePromo();
  const pathname = usePathname();
  // Dónde está el escenario, medido para esta promoción y esta página. Hasta medir, la franja
  // espera: si saliera primero y luego se guardara, parpadearía al cargar.
  const [stage, setStage] = useState({ sig: "", onTop: false, dark: false });

  // El enlace de un descuento de carrito trae su propia franja con su propio reloj.
  const ownOffer =
    typeof window !== "undefined" &&
    pathname.startsWith("/checkout") &&
    new URLSearchParams(window.location.search).has("oferta");
  const here = Boolean(promo) && isStorePath(pathname) && !ownOffer;
  const promoKey = promo?.key;
  const sig = `${promoKey ?? ""}|${pathname}`;
  const headerOnBlack = stage.sig === sig && stage.dark;
  const visible = here && stage.sig === sig && !stage.onTop;

  // Se mira el escenario y no el contexto: el servidor ya lo pinta antes de que el navegador
  // sepa de la promoción, y el encabezado tiene que leerse desde el primer instante.
  useEffect(() => {
    let frame = 0;
    const read = () => {
      // `top`: primera pantalla, la franja se guarda. `teaser`: va más abajo y la franja sigue
      // puesta, así que el encabezado queda 48 px más abajo.
      let onTop = false;
      let dark = false;
      for (const el of document.querySelectorAll<HTMLElement>("[data-promo-stage]")) {
        const rect = el.getBoundingClientRect();
        if (el.dataset.promoStage === "top") {
          if (rect.top <= 28 && rect.bottom > 64) onTop = dark = true;
        } else if (rect.top <= 76 && rect.bottom > 112) {
          dark = true;
        }
      }
      setStage((current) =>
        current.sig === sig && current.onTop === onTop && current.dark === dark
          ? current
          : { sig, onTop, dark },
      );
    };
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(read);
    };
    onScroll();
    document.documentElement.setAttribute("data-promo-ready", "");
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sig]);

  useEffect(() => {
    const root = document.documentElement;
    if (headerOnBlack) root.setAttribute("data-promo-dark", "");
    else root.removeAttribute("data-promo-dark");
    return () => root.removeAttribute("data-promo-dark");
  }, [headerOnBlack]);

  // La barra del navegador copia este color. Mientras el escenario está arriba, es el mismo negro.
  useEffect(() => {
    if (!headerOnBlack) return;
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#09090b";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [headerOnBlack]);

  useEffect(() => {
    if (!visible) return;
    const root = document.documentElement;
    root.style.setProperty(BAR_VAR, BAR_HEIGHT);
    return () => {
      root.style.removeProperty(BAR_VAR);
    };
  }, [visible]);

  const key = promo?.key;
  const label = promo?.label;
  const counts = Boolean(promo && promo.phase === "live" && !promo.preview && here);
  useEffect(() => {
    if (!counts || !key || !label) return;
    insightPromo("view", { key, label });
  }, [counts, key, label]);

  if (!promo || !here) return null;
  return <Bar promo={promo} on={visible} linked={!pathname.startsWith("/checkout")} />;
}

function plural(value: number, one: string, many: string) {
  return `${value} ${value === 1 ? one : many}`;
}

/** La cuenta regresiva completa, con segundos: se ve correr. `short` es la de celular. */
function clockText(parts: TimeParts, short: boolean) {
  const mins = two(parts.mins);
  const secs = two(parts.secs);
  if (parts.days > 0) {
    return short
      ? `${parts.days}d ${two(parts.hours)}h ${mins}m ${secs}s`
      : `${plural(parts.days, "día", "días")}, ${plural(parts.hours, "hora", "horas")}, ${mins} min, ${secs} s`;
  }
  if (parts.hours > 0) return `${two(parts.hours)}:${mins}:${secs}`;
  return `${mins}:${secs}`;
}

function Bar({ promo, on, linked }: { promo: ActivePromo; on: boolean; linked: boolean }) {
  const live = promo.phase === "live";
  const left = useRemaining(live ? promo.endsAt : promo.startsAt);
  const parts = left == null ? null : splitTime(left);

  const row = (
    <>
      <PromoHangTag label={promo.label} />
      <span className="promo-bar-main">{promo.percent}% de descuento</span>
      <span
        className="promo-bar-clock"
        role="timer"
        aria-label={parts ? `${live ? "Termina" : "Empieza"} en ${spokenTime(parts)}` : undefined}
      >
        <span className="promo-bar-verb">{live ? "Termina en" : "Empieza en"}</span>
        <span aria-hidden className="promo-bar-time">
          <span className="promo-bar-long">{parts ? clockText(parts, false) : " "}</span>
          <span className="promo-bar-short">{parts ? clockText(parts, true) : " "}</span>
        </span>
      </span>
    </>
  );

  return (
    <div className="promo-bar" data-on={on ? "" : undefined} data-kind={promo.kind} aria-hidden={!on}>
      {linked ? (
        <Link
          href="/#coleccion"
          className="promo-bar-row"
          tabIndex={on ? undefined : -1}
          onClick={() => {
            if (live && !promo.preview) insightPromo("cta", promo);
          }}
        >
          {row}
        </Link>
      ) : (
        <div className="promo-bar-row">{row}</div>
      )}
      <div aria-hidden className="promo-bar-line" />
    </div>
  );
}
