import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pedir talla",
  description:
    "Con tu número de pedido confirma la talla del anillo Mora. El medidor llega primero. El anillo, el 20 de noviembre.",
  robots: { index: false, follow: true },
};

export default function TallaLayout({ children }: { children: ReactNode }) {
  return children;
}
