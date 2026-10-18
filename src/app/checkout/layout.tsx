import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Reserva tu Mora Pro o Mora Ultra. Preventa con entrega el 20 de noviembre. Envío cotizado al instante en Colombia.",
  robots: { index: false, follow: true },
};

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
