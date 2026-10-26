import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FALLBACK_SALES } from "@/commerce/sales";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    FALLBACK_SALES.mode === "presale"
      ? `Reserva tu Mora Pro o Mora Ultra. Preventa con entrega el ${FALLBACK_SALES.deliveryFull}. Envío gratis a toda Colombia.`
      : "Compra tu Mora Pro o Mora Ultra. Envío gratis a toda Colombia.",
  robots: { index: false, follow: true },
};

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
