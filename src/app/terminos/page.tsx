import type { Metadata } from "next";
import { BRAND } from "@/brand";
import { FALLBACK_SALES } from "@/commerce/sales";
import { resolveLegalLang } from "@/components/legal/resolveLang";
import { siteUrl } from "@/lib/site";
import { TerminosBody } from "./TerminosBody";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { lang } = await searchParams;
  const initial = await resolveLegalLang(lang, "es");
  const es = initial === "es";
  const sales = FALLBACK_SALES;
  return {
    title: es ? "Condiciones del servicio" : "Terms of service",
    description: es
      ? "Términos de uso de moraring.com, la tienda Mora Ring, WhatsApp comercial y servicios relacionados en Colombia."
      : "Terms for moraring.com, the Mora Ring store, commercial WhatsApp, and related services in Colombia.",
    alternates: {
      canonical: "/terminos",
      languages: {
        "es-CO": "/terminos?lang=es",
        en: "/terminos?lang=en",
      },
    },
    openGraph: {
      title: `${es ? "Condiciones del servicio" : "Terms of service"} — ${BRAND.name}`,
      description: es
        ? sales.termsLead
        : "Purchases, payments, shipping, and commercial contact in Colombia.",
      url: siteUrl("/terminos"),
      locale: es ? "es_CO" : "en_US",
    },
    robots: { index: true, follow: true },
  };
}

export default async function TerminosPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const initial = await resolveLegalLang(lang, "es");
  return <TerminosBody initial={initial} />;
}
