"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  applyPricing,
  DEFAULT_PRICING,
  normalizePricing,
  type Pricing,
} from "@/commerce/pricing";
import {
  DEFAULT_SALES_POLICY,
  resolveSalesPresentation,
  type SalesPresentation,
} from "@/commerce/sales";

const Ctx = createContext<SalesPresentation>(resolveSalesPresentation(DEFAULT_SALES_POLICY));
const PricingCtx = createContext<Pricing>(DEFAULT_PRICING);

export function SalesProvider({
  initial,
  children,
}: {
  initial: SalesPresentation;
  children: ReactNode;
}) {
  const [sales, setSales] = useState(initial);
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);

  useEffect(() => {
    let alive = true;
    void fetch("/api/sales", { cache: "no-store" })
      .then((res) => res.json())
      .then(
        (data: {
          ok?: boolean;
          sales?: SalesPresentation;
          pricing?: Record<string, unknown>;
        }) => {
          if (!alive || !data.ok) return;
          if (data.sales) setSales(data.sales);
          if (data.pricing) {
            const next = normalizePricing(data.pricing);
            // Primero el catálogo compartido, luego el render: quien lea products[x].price
            // durante el re-render ya ve el precio vivo.
            applyPricing(next);
            setPricing(next);
          }
        },
      )
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Ctx.Provider value={sales}>
      <PricingCtx.Provider value={pricing}>{children}</PricingCtx.Provider>
    </Ctx.Provider>
  );
}

export function useSales() {
  return useContext(Ctx);
}

/**
 * Precios vivos (Pro, Ultra, Case). Suscribirse aquí hace que el componente se vuelva a
 * pintar cuando el super admin cambia un precio; `products[x].price` ya trae el valor.
 */
export function usePricing() {
  return useContext(PricingCtx);
}
