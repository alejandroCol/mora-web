import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Encuesta",
  description: "Elige los tres colores de anillo que usarías.",
  robots: { index: false, follow: false },
};

export default function EncuestaLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-paper text-ink">{children}</div>;
}
