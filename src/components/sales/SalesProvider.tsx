"use client";

import { createContext, useContext, type ReactNode } from "react";
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
  return <Ctx.Provider value={initial}>{children}</Ctx.Provider>;
}

export function useSales() {
  return useContext(Ctx);
}
