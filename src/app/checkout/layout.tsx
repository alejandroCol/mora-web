import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Reserva tu Mora Aero o Titan. Envío cotizado al instante en Colombia. Pago con Wompi.",
  robots: { index: false, follow: true },
};

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
