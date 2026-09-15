import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Mi pedido",
  description: "Sigue el estado de tu anillo Mora con el número de pedido.",
  robots: { index: false, follow: true },
};

export default function PedidoLayout({ children }: { children: ReactNode }) {
  return children;
}
