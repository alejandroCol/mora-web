"use client";

import { promoPriceOf } from "@/commerce/promos";
import { useLivePromo } from "@/components/sales/SalesProvider";
import { formatMoney } from "@/lib/catalog";
import "@/components/promo/promo.css";

/**
 * El precio de la ficha, a la derecha. Con una promoción en vivo: el precio de antes tachado,
 * debajo «Ahorras 10 %» y al final, con más peso, el precio que se paga.
 */
export function ProductPrice({ value }: { value: number }) {
  const promo = useLivePromo();
  if (!promo) {
    return (
      <p className="price-block">
        <span className="price-now">{formatMoney(value)}</span>
      </p>
    );
  }
  return (
    <p className="price-block">
      <span className="sr-only">Antes </span>
      <s className="price-was">{formatMoney(value)}</s>
      <span className="sr-only">, ahora </span>
      <span className="price-now">{formatMoney(promoPriceOf(value, promo))}</span>
      <span className="promo-tag save-tag">Ahorras {promo.percent} %</span>
    </p>
  );
}
