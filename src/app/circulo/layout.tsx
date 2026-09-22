import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Círculo",
  description: "Cómo están los tuyos. Sin ranking.",
  robots: { index: false, follow: false },
};

export default function CirculoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-dvh bg-dawn text-ink">{children}</div>;
}
