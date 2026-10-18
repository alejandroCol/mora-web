import { Atelier } from "@/components/landing/Atelier";
import { Close } from "@/components/landing/Close";
import { Faq } from "@/components/landing/Faq";
import { Film } from "@/components/landing/Film";
import { Hero } from "@/components/landing/Hero";
import { PresaleModule } from "@/components/presale/PresaleModule";

export default function Home() {
  return (
    <>
      <Hero />
      <PresaleModule />
      <Film />
      <Atelier />
      <Close />
      <Faq />
    </>
  );
}
