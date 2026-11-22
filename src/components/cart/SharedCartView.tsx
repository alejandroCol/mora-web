"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cartCount, subtotalOf } from "@/commerce/cartMath";
import { promoDiscountOf } from "@/commerce/promos";
import { cartCountLabel, lineUnitPrice } from "@/commerce/lines";
import type { CartLine } from "@/commerce/types";
import { PromoPrice } from "@/components/promo/PromoPrice";
import { useLivePromo, usePricing } from "@/components/sales/SalesProvider";
import { formatMoney } from "@/lib/catalog";
import { useCartCount, useMoraStore } from "@/lib/store";
import { CartLineVisual } from "./CartLineVisual";

export function SharedCartView({ items }: { items: CartLine[] }) {
  const router = useRouter();
  usePricing();
  const promo = useLivePromo();
  const own = useCartCount();
  const adopt = useMoraStore((state) => state.adoptSharedCart);
  const subtotal = subtotalOf(items);
  const promoCop = promoDiscountOf(subtotal, promo);
  const pieces = cartCount(items);

  function take(mode: "replace" | "add") {
    adopt(items, mode);
    router.push("/");
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] px-4 pt-[calc(4.75rem+env(safe-area-inset-top))] pb-[calc(9.5rem+env(safe-area-inset-bottom))]">
      <p className="text-[14px] font-medium text-[#6f61b8]">Te compartieron un pedido</p>
      <h1 className="mt-2 text-[2rem] leading-[1.12] tracking-[-0.035em] text-ink">
        {cartCountLabel(pieces, items)}
      </h1>
      <p className="mt-2 text-[15px] leading-6 text-soft">
        Tal como los eligieron. El precio es el de hoy y puedes terminarlo cuando quieras.
      </p>

      <ul className="mt-6 divide-y divide-line rounded-[24px] bg-white px-4">
        {items.map((line) => (
          <li key={line.key} className="py-4">
            <CartLineVisual line={line} price={formatMoney(lineUnitPrice(line) * line.qty)} />
          </li>
        ))}
      </ul>
      <PromoNote subtotal={subtotal} promoCop={promoCop} label={promo?.label} percent={promo?.percent} />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-[480px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-soft">{promoCop > 0 ? "Hoy pagas" : "Subtotal"}</span>
            <span className="text-[17px] tracking-[-0.02em] text-ink">
              {promoCop > 0 ? (
                formatMoney(subtotal - promoCop)
              ) : (
                <PromoPrice value={subtotal} />
              )}
            </span>
          </div>
          {own > 0 ? (
            <p className="mt-1.5 text-[12px] leading-5 text-soft">
              Ya tienes un carrito. Este pedido lo reemplaza.
            </p>
          ) : null}
          <button type="button" onClick={() => take("replace")} className="elegir-cta mt-3 w-full">
            Quedarme con este pedido
            <span aria-hidden className="elegir-cta-arrow">
              ›
            </span>
          </button>
          {own > 0 ? (
            <button
              type="button"
              onClick={() => take("add")}
              className="mt-2 flex h-11 w-full items-center justify-center text-[14px] text-[#6f61b8]"
            >
              Sumar a lo que ya tengo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PromoNote({
  subtotal,
  promoCop,
  label,
  percent,
}: {
  subtotal: number;
  promoCop: number;
  label?: string;
  percent?: number;
}) {
  if (promoCop <= 0 || !label || !percent) return null;
  return (
    <p className="mt-4 text-center text-[13px] text-soft">
      {label} · −{percent} % · antes <span className="line-through">{formatMoney(subtotal)}</span>
    </p>
  );
}

export function SharedCartMissing() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center px-6 pt-[calc(7rem+env(safe-area-inset-top))] text-center">
      <p className="text-[14px] font-medium text-[#6f61b8]">Enlace</p>
      <h1 className="mt-2 text-[1.7rem] tracking-[-0.03em] text-ink">Este pedido ya no está</h1>
      <p className="mt-2 text-[15px] leading-6 text-soft">
        El enlace venció o no existe. Pide que te lo vuelvan a enviar.
      </p>
      <Link href="/#coleccion" className="elegir-cta mt-6">
        Ver los anillos
      </Link>
    </div>
  );
}
