"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_SALES_POLICY,
  resolveSalesPresentation,
  type SalesPresentation,
} from "@/commerce/sales";

const Ctx = createContext<SalesPresentation>(resolveSalesPresentation(DEFAULT_SALES_POLICY));

export function SalesProvider({
  initial,
  children,
}: {
  initial: SalesPresentation;
  children: ReactNode;
}) {
  const [sales, setSales] = useState(initial);

  useEffect(() => {
    let alive = true;
    void fetch("/api/sales")
      .then((res) => res.json())
      .then((data: { ok?: boolean; sales?: SalesPresentation }) => {
        if (alive && data.ok && data.sales) setSales(data.sales);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return <Ctx.Provider value={sales}>{children}</Ctx.Provider>;
}

export function useSales() {
  return useContext(Ctx);
}
