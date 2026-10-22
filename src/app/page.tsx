import { Atelier } from "@/components/landing/Atelier";
import { Close } from "@/components/landing/Close";
import { Faq } from "@/components/landing/Faq";
import { Film } from "@/components/landing/Film";
import { Hero } from "@/components/landing/Hero";
import { PresaleModule } from "@/components/presale/PresaleModule";
import { getSalesPresentation } from "@/server/salesPolicy";

export default async function Home() {
  const sales = await getSalesPresentation();
  return (
    <>
      <link
        rel="preload"
        href="/models/ring-particles.bin"
        as="fetch"
        crossOrigin="anonymous"
      />
      <Hero />
      {sales.showPresaleModule ? <PresaleModule /> : null}
      <Film />
      <Atelier />
      <Close />
      <Faq />
    </>
  );
}
