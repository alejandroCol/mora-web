import type { Metadata } from "next";
import { BRAND } from "@/brand";
import { DownloadStudio } from "@/components/downloads/DownloadStudio";
import { IphoneSteps } from "@/components/downloads/IphoneSteps";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Descarga en iPhone",
  description: "Dos pasos para tener Mora Ring en tu iPhone: TestFlight y luego la app.",
  alternates: { canonical: "/descargas/iphone" },
  openGraph: {
    title: `Descarga en iPhone · ${BRAND.siteName}`,
    description: "Primero TestFlight. Después, Mora Ring.",
    url: siteUrl("/descargas/iphone"),
    locale: "es_CO",
    images: [{ url: "/descargas/pulso.jpg", width: 576, height: 1024, alt: "La app Mora Ring" }],
  },
  robots: { index: true, follow: true },
};

export default function IphoneDownloadPage() {
  return (
    <DownloadStudio>
      <IphoneSteps />
    </DownloadStudio>
  );
}
