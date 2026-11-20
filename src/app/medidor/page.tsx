import type { Metadata } from "next";
import { RingSizer } from "@/components/medidor/RingSizer";

// Página de prueba: sin enlaces desde la tienda y fuera de buscadores.
export const metadata: Metadata = {
  title: "Medidor de talla",
  description: "Pon tu anillo sobre la pantalla y descubre tu talla Mora.",
  robots: { index: false, follow: false },
};

export default function MedidorPage() {
  return <RingSizer />;
}
