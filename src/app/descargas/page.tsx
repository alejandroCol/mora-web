import type { Metadata } from "next";
import { BRAND } from "@/brand";
import { DownloadExperience } from "@/components/downloads/DownloadExperience";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Descarga la app",
  description:
    "Descarga Mora Ring para iPhone o Android. La app de tu anillo: noche, pulso y cuerpo.",
  alternates: { canonical: "/descargas" },
  openGraph: {
    title: `Descarga la app — ${BRAND.name}`,
    description: "La app de tu anillo Mora, para iPhone y Android.",
    url: siteUrl("/descargas"),
    locale: "es_CO",
    images: [{ url: "/descargas/pulso.jpg", width: 576, height: 1024, alt: "La app Mora Ring" }],
  },
  robots: { index: true, follow: true },
};

export default function DescargasPage() {
  return <DownloadExperience />;
}
