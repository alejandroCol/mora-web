import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSalesPresentation } from "@/server/salesPolicy";

export async function generateMetadata(): Promise<Metadata> {
  const sales = await getSalesPresentation();
  return {
    title: "Checkout",
    description:
      sales.mode === "presale"
        ? `Reserva tu Mora Pro o Mora Ultra. Preventa con entrega el ${sales.deliveryFull}. Envío cotizado al instante en Colombia.`
        : "Compra tu Mora Pro o Mora Ultra. Envío cotizado al instante en Colombia.",
    robots: { index: false, follow: true },
  };
}

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
