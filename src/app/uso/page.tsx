import type { Metadata } from "next";
import { DownloadStudio } from "@/components/downloads/DownloadStudio";
import { UsoExperience } from "@/components/uso/UsoExperience";

// Privada por ahora: sin enlace en la tienda y fuera de los buscadores.
export const metadata: Metadata = {
  title: "Uso de mi Mora",
  description: "Tutoriales para usar la app de tu anillo.",
  robots: { index: false, follow: false },
};

export default async function UsoPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <DownloadStudio>
      <UsoExperience initialId={t} />
    </DownloadStudio>
  );
}
