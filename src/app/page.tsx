import type { Metadata } from "next";
import { Atelier } from "@/components/landing/Atelier";
import { CaseCollage } from "@/components/landing/CaseCollage";
import { CreatorsStrip } from "@/components/landing/CreatorsStrip";
import { Close } from "@/components/landing/Close";
import { Faq } from "@/components/landing/Faq";
import { Film } from "@/components/landing/Film";
import { Hero } from "@/components/landing/Hero";
import { PresaleModule } from "@/components/presale/PresaleModule";
import { FaqJsonLd } from "@/components/seo/JsonLd";
import { FALLBACK_SALES } from "@/commerce/sales";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <link
        rel="preload"
        href="/models/ring-particles.bin"
        as="fetch"
        crossOrigin="anonymous"
      />
      <FaqJsonLd sales={FALLBACK_SALES} />
      <Hero />
      <Atelier />
      <Film />
      <PresaleModule />
      <CaseCollage />
      <CreatorsStrip />
      <Close />
      <Faq />
    </>
  );
}
