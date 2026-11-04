import type { Metadata } from "next";
import { BRAND } from "@/brand";
import { resolveLegalLang } from "@/components/legal/resolveLang";
import { siteUrl } from "@/lib/site";
import { PrivacidadBody } from "./PrivacidadBody";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { lang } = await searchParams;
  const initial = await resolveLegalLang(lang, "en");
  const es = initial === "es";
  return {
    title: es ? "Política de privacidad" : "Privacy Policy",
    description: es
      ? "Cómo trata Mora tus datos en la app Mora Ring, Círculo y moraring.com. Bienestar, no medicina. El ciclo se queda en el teléfono."
      : "How Mora handles your data in the Mora Ring app, Círculo, and moraring.com. Wellness, not medical care. Cycle data stays on your phone.",
    alternates: {
      canonical: "/privacidad",
      languages: {
        "es-CO": "/privacidad?lang=es",
        en: "/privacidad?lang=en",
      },
    },
    openGraph: {
      title: `${es ? "Política de privacidad" : "Privacy Policy"} — ${BRAND.name}`,
      description: es
        ? "El anillo vive en tu teléfono. Círculo solo sube resúmenes si tú lo activas."
        : "Transparency about ring data, the app, Círculo, and the store. Optional cloud summaries; local cycle tracking.",
      url: siteUrl("/privacidad"),
      locale: es ? "es_CO" : "en_US",
    },
    robots: { index: true, follow: true },
  };
}

export default async function PrivacidadPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const initial = await resolveLegalLang(lang, "en");
  return <PrivacidadBody initial={initial} />;
}
