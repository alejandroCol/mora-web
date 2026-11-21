import type { CSSProperties } from "react";
import "./promo.css";

const LOGOS: Record<string, { src: string; ratio: number }> = {
  "Black Friday": { src: "/promo/black-friday.png", ratio: 735 / 350 },
  "Hora Loca": { src: "/promo/hora-loca.png", ratio: 548 / 277 },
};

/**
 * El logotipo de la promoción, pintado como máscara: toma el color del texto de quien lo usa.
 * «Black Week» no tiene logotipo propio: va escrito en el mismo bloque de dos renglones.
 */
export function PromoLogo({ label, className = "" }: { label: string; className?: string }) {
  const logo = LOGOS[label];
  if (!logo) {
    const [first, ...rest] = label.split(" ");
    return (
      <span className={`promo-logo promo-logo-text ${className}`}>
        {first}
        <br />
        {rest.join(" ")}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={label}
      className={`promo-logo ${className}`}
      style={{ "--logo": `url(${logo.src})`, aspectRatio: String(logo.ratio) } as CSSProperties}
    />
  );
}

/**
 * Etiqueta colgante, como la de una joya: lila, con su ojal y su hilo.
 * `swing` la deja colgando del borde de arriba y la mece al entrar.
 */
export function PromoHangTag({ label, swing = false }: { label: string; swing?: boolean }) {
  return (
    <span className={`promo-hang ${swing ? "promo-hang-swing" : ""}`}>
      <span className="promo-hang-tag">
        <span aria-hidden className="promo-hang-eye" />
        <PromoLogo label={label} />
      </span>
    </span>
  );
}
