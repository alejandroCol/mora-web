import type { Metadata } from "next";
import { Atelier } from "@/components/landing/Atelier";
import { CaseCollage } from "@/components/landing/CaseCollage";
import { Close } from "@/components/landing/Close";
import { Faq } from "@/components/landing/Faq";
import { Film } from "@/components/landing/Film";
import { Hero } from "@/components/landing/Hero";
import { PresaleModule } from "@/components/presale/PresaleModule";
import { PromoStage } from "@/components/promo/PromoStage";
import { FaqJsonLd } from "@/components/seo/JsonLd";
import { pickPromo, type ActivePromo } from "@/commerce/promos";
import { FALLBACK_SALES } from "@/commerce/sales";
import { publicPromos } from "@/server/promos";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// El inicio se vuelve a generar cada minuto: así el escenario de Black Friday / Hora Loca
// ya viene en el HTML y la página no salta cuando el navegador se entera de la promoción.
export const revalidate = 60;

async function promoAtRender(): Promise<ActivePromo | null> {
  // Al compilar no se toca Firestore: la primera regeneración ya lo lee.
  if (process.env.NEXT_PHASE === "phase-production-build") return null;
  try {
    const { now, windows } = await publicPromos();
    return pickPromo(windows, now);
  } catch {
    return null;
  }
}

export default async function Home() {
  const promo = await promoAtRender();
  return (
    <>
      <link
        rel="preload"
        href="/models/ring-particles.bin"
        as="fetch"
        crossOrigin="anonymous"
      />
      <FaqJsonLd sales={FALLBACK_SALES} />
      <PromoStage slot="top" initial={promo} />
      <Hero />
      <PromoStage slot="teaser" initial={promo} />
      <Atelier />
      <CaseCollage />
      <Film />
      <PresaleModule />
      <Close />
      <Faq />
    </>
  );
}
