import type { Metadata } from "next";
import { BRAND } from "@/brand";
import { DownloadStudio } from "@/components/downloads/DownloadStudio";
import { IphoneSteps } from "@/components/downloads/IphoneSteps";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Descarga en iPhone · TestFlight",
  description: "Dos pasos para tener Mora Ring en tu iPhone: TestFlight y luego la app.",
  alternates: { canonical: "/descarga-testers" },
  openGraph: {
    title: `Descarga en iPhone · ${BRAND.siteName}`,
    description: "Primero TestFlight. Después, Mora Ring.",
    url: siteUrl("/descarga-testers"),
    locale: "es_CO",
    images: [{ url: "/descargas/pulso.jpg", width: 576, height: 1024, alt: "La app Mora Ring" }],
  },
  robots: { index: false, follow: false },
};

export default function TestersDownloadPage() {
  return (
    <DownloadStudio>
      <IphoneSteps />
    </DownloadStudio>
  );
}
