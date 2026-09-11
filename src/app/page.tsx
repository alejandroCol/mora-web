import { Atelier } from "@/components/landing/Atelier";
import { Close } from "@/components/landing/Close";
import { Film } from "@/components/landing/Film";
import { Hero } from "@/components/landing/Hero";
import { Reserve } from "@/components/landing/Reserve";

export default function Home() {
  return (
    <>
      <Hero />
      <Film />
      <Atelier />
      <Reserve />
      <Close />
    </>
  );
}
