import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pedir talla",
  description:
    "Con tu número de pedido cuéntanos tu talla y te enviamos tu anillo Mora Ring.",
  robots: { index: false, follow: true },
};

export default function TallaLayout({ children }: { children: ReactNode }) {
  return children;
}
