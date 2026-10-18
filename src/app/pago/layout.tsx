import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pago",
  description: "Confirmación de pago.",
  robots: { index: false, follow: false },
};

export default function PagoLayout({ children }: { children: ReactNode }) {
  return children;
}
