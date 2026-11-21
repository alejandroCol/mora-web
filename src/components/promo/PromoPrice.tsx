"use client";

import { promoPriceOf } from "@/commerce/promos";
import { useLivePromo } from "@/components/sales/SalesProvider";
import { formatMoney } from "@/lib/catalog";
import "./promo.css";

/**
 * Un precio. Con Black Friday / Hora Loca en vivo: el de antes tachado y el nuevo al lado.
 * Sin promoción pinta lo mismo que `formatMoney`.
 */
export function PromoPrice({ value, stacked = false }: { value: number; stacked?: boolean }) {
  const promo = useLivePromo();
  if (!promo) return <>{formatMoney(value)}</>;
  return (
    <span className={`promo-price ${stacked ? "promo-price-stacked" : ""}`}>
      <span className="sr-only">Antes </span>
      <s className="promo-was">{formatMoney(value)}</s>
      <span className="sr-only">, ahora </span>
      <span className="promo-now">{formatMoney(promoPriceOf(value, promo))}</span>
    </span>
  );
}

/** «Black Friday · −10 %». Nada si no hay promoción en vivo. */
export function PromoTag({ className = "" }: { className?: string }) {
  const promo = useLivePromo();
  if (!promo) return null;
  return (
    <span className={`promo-tag ${className}`}>
      {promo.label} · −{promo.percent} %
    </span>
  );
}
