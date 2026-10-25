import { Atelier } from "@/components/landing/Atelier";
import { CreatorsStrip } from "@/components/landing/CreatorsStrip";
import { Close } from "@/components/landing/Close";
import { Faq } from "@/components/landing/Faq";
import { Film } from "@/components/landing/Film";
import { Hero } from "@/components/landing/Hero";
import { PresaleModule } from "@/components/presale/PresaleModule";

export default function Home() {
  return (
    <>
      <link
        rel="preload"
        href="/models/ring-particles.bin"
        as="fetch"
        crossOrigin="anonymous"
      />
      <Hero />
      <PresaleModule />
      <Film />
      <Atelier />
      <CreatorsStrip />
      <Close />
      <Faq />
    </>
  );
}
