import type { Metadata } from "next";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { siteUrl } from "@/lib/site";

export function generateMetadata(): Metadata {
  return {
    title: "Cómo se calcula tu noche",
    description:
      "El sueño en Mora es una estimación: el anillo lee movimiento y pulso, y un algoritmo calcula las fases. Bienestar, no médico.",
    alternates: { canonical: "/datos-del-sueno" },
    openGraph: {
      title: `Cómo se calcula tu noche · ${BRAND.siteName}`,
      description: "El anillo lee movimiento y pulso. Las fases del sueño son una estimación.",
      url: siteUrl("/datos-del-sueno"),
      locale: "es_CO",
    },
    robots: { index: true, follow: true },
  };
}

/** Mismo texto que la app (`NightEstimateView`). Si cambia uno, cambia el otro. */
const BLOCKS = [
  {
    id: "lee",
    title: "Lo que lee el anillo",
    body: "Mientras duermes, el anillo registra tu movimiento y tu pulso.",
  },
  {
    id: "estima",
    title: "Lo que se estima",
    body: "Con esas señales, un algoritmo calcula cuándo te dormiste y despertaste, las fases (profundo, ligero, REM y despierto) y el puntaje. El anillo no lee la actividad del cerebro, que es lo que usa un estudio de sueño en laboratorio. Por eso las fases son aproximadas.",
  },
  {
    id: "sirve",
    title: "Para qué sirve",
    body: "Para ver cómo cambian tus noches con el tiempo. Mora es bienestar: no diagnostica ni reemplaza una consulta. Si te preocupa tu sueño, habla con un profesional de salud.",
  },
] as const;

export default function DatosDelSuenoPage() {
  return (
    <div className="relative overflow-hidden" lang="es-CO">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Cómo se calcula tu noche", path: "/datos-del-sueno" },
        ]}
      />
      <div className="hero-wash border-b border-line">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-28 pt-16 text-center sm:pt-20">
          <div className="frame-in flex flex-col items-center">
            <BrandLogo variant="mark" className="h-14 w-14 object-contain drop-shadow-sm" priority />
            <p className="kicker mt-8">Sueño</p>
            <h1 className="display mt-3 text-[clamp(2.1rem,6vw,3.25rem)] leading-[1.06] text-ink">
              Cómo se calcula tu noche
            </h1>
            <p className="title-whisper mt-4 max-w-lg text-[clamp(1.05rem,2.8vw,1.25rem)] text-soft">
              Tu noche es una estimación.
            </p>
          </div>
        </div>
      </div>

      <article className="mx-auto -mt-16 max-w-3xl space-y-5 px-6 pb-24 sm:-mt-20 lg:space-y-6 lg:pb-32">
        {BLOCKS.map((block, index) => (
          <section
            key={block.id}
            id={block.id}
            className="frame-in reserve-sheet scroll-mt-28 border border-line-strong/30 p-6 sm:p-8"
            style={{ animationDelay: `${160 + index * 40}ms` }}
          >
            <h2 className="font-display text-[1.45rem] tracking-[-0.03em] text-ink sm:text-[1.65rem]">
              {block.title}
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-soft">{block.body}</p>
          </section>
        ))}
      </article>
    </div>
  );
}
