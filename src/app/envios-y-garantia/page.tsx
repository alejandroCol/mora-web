import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { BRAND } from "@/brand";
import { FALLBACK_SALES } from "@/commerce/sales";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { WhatsAppLink } from "@/components/growth/WhatsAppLink";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { sizeRangeLabel } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";

const UPDATED = "25 de octubre de 2026";

export function generateMetadata(): Metadata {
  return {
    title: "Envíos, cambios y garantía",
    description:
      "Envíos a todo Colombia, medidor de talla, retracto y garantía de un mes de Mora Ring.",
    alternates: { canonical: "/envios-y-garantia" },
    openGraph: {
      title: `Envíos, cambios y garantía — ${BRAND.name}`,
      description: "A todo Colombia. La talla se define antes de fabricar. Garantía de un mes.",
      url: siteUrl("/envios-y-garantia"),
      locale: "es_CO",
    },
    robots: { index: true, follow: true },
  };
}

type Section = {
  id: string;
  kicker: string;
  title: string;
  body: ReactNode;
};

function sections(): Section[] {
  const sales = FALLBACK_SALES;
  return [
    {
      id: "envios",
      kicker: "01",
      title: "Envíos",
      body: (
        <>
          <p>Enviamos a todo Colombia. El costo se cotiza en el checkout, según la ciudad.</p>
          <p>
            El seguimiento está en{" "}
            <Link href="/pedido" className="text-ink underline decoration-bloom/80 underline-offset-2">
              Mi pedido
            </Link>
            , con el número de tu orden.
          </p>
          {sales.mode === "presale" && sales.deliveryFull ? (
            <p>
              En preventa, la entrega prevista es el{" "}
              <strong className="font-medium text-ink">{sales.deliveryFull}</strong>. Si el calendario
              cambia, te avisamos por el canal de tu pedido.
            </p>
          ) : (
            <p>El anillo se fabrica y se envía después del pago. El tiempo depende del destino.</p>
          )}
        </>
      ),
    },
    {
      id: "medidor",
      kicker: "02",
      title: "Medidor de talla",
      body: (
        <>
          <p>
            No cambiamos la talla después de fabricar el anillo. Por eso puedes pedir el medidor: llega
            primero, te mides y confirmas el número. Entonces fabricamos.
          </p>
          <ol className="space-y-3">
            {sales.sizeSteps.map((step) => (
              <li key={step.title}>
                <strong className="font-medium text-ink">{step.title}.</strong> {step.body}
              </li>
            ))}
          </ol>
          <p>
            Confirmas en{" "}
            <Link href="/talla" className="text-ink underline decoration-bloom/80 underline-offset-2">
              tu pedido
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "talla",
      kicker: "03",
      title: "Talla",
      body: (
        <p>
          No hay cambio de talla. Si no estás seguro, pide el medidor al comprar. Si ya conoces tu
          número, elígelo en la ficha: de {sizeRangeLabel()}.
        </p>
      ),
    },
    {
      id: "retracto",
      kicker: "04",
      title: "Derecho de retracto",
      body: (
        <>
          <p>
            En una compra a distancia tienes cinco días hábiles desde la entrega para desistir, según el
            artículo 47 de la Ley 1480 de 2011. Escríbenos con el número de pedido.
          </p>
          <p>
            El retracto devuelve el producto. No es un cambio de talla: esa opción no existe, y el
            medidor está para acertar antes de fabricar.
          </p>
        </>
      ),
    },
    {
      id: "garantia",
      kicker: "05",
      title: "Garantía",
      body: (
        <>
          <p>
            La garantía de Mora es de <strong className="font-medium text-ink">un mes</strong> desde la
            entrega. Cubre fallas de fabricación: el anillo no enciende, la batería no carga o un sensor
            deja de responder.
          </p>
          <p>
            No cubre golpes, rayones de uso ni agua fuera de lo que dice la ficha. Pro admite 5 ATM:
            ducha y nado en superficie. Ultra es IP67: un chapuzón breve, sin nadar.
          </p>
          <p>
            Para reclamar, escribe por WhatsApp o a {BRAND.contact.email} con el número de pedido y qué
            falló. Mora es bienestar, no un dispositivo médico.
          </p>
        </>
      ),
    },
    {
      id: "contacto",
      kicker: "06",
      title: "Contacto",
      body: (
        <p>
          <WhatsAppLink className="text-ink underline decoration-bloom/80 underline-offset-2">
            WhatsApp
          </WhatsAppLink>
          {" · "}
          <a
            href={`mailto:${BRAND.contact.email}`}
            className="text-ink underline decoration-bloom/80 underline-offset-2"
          >
            {BRAND.contact.email}
          </a>
        </p>
      ),
    },
  ];
}

export default function EnviosPage() {
  const blocks = sections();
  return (
    <div className="relative overflow-hidden" lang="es-CO">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Envíos, cambios y garantía", path: "/envios-y-garantia" },
        ]}
      />
      <div className="hero-wash border-b border-line">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-28 pt-16 text-center sm:pt-20">
          <div className="frame-in flex flex-col items-center">
            <BrandLogo variant="mark" className="h-14 w-14 object-contain drop-shadow-sm" priority />
            <p className="kicker mt-8">Tienda</p>
            <h1 className="display mt-3 text-[clamp(2.1rem,6vw,3.25rem)] leading-[1.06] text-ink">
              Envíos, cambios y garantía
            </h1>
            <p className="title-whisper mt-4 max-w-lg text-[clamp(1.05rem,2.8vw,1.25rem)] text-soft">
              A todo Colombia. La talla se define antes de fabricar. La garantía es de un mes.
            </p>
            <p className="mt-6 text-[13px] text-soft">Última actualización · {UPDATED}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-24 pt-0 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-14 lg:pb-32">
        <nav
          aria-label="En esta página"
          className="frame-in reserve-sheet sticky top-24 z-10 hidden h-fit p-5 lg:block"
        >
          <p className="kicker mb-4">En esta página</p>
          <ul className="space-y-2 text-[13px]">
            {blocks.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-xl px-2 py-1.5 text-soft transition hover:bg-lilac/40 hover:text-ink"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="-mt-16 space-y-5 sm:-mt-20 lg:mt-0 lg:space-y-6">
          {blocks.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="frame-in reserve-sheet scroll-mt-28 border border-line-strong/30 p-6 sm:p-8"
              style={{ animationDelay: `${160 + index * 40}ms` }}
            >
              <p className="kicker">{section.kicker}</p>
              <h2 className="mt-2 font-display text-[1.45rem] tracking-[-0.03em] text-ink sm:text-[1.65rem]">
                {section.title}
              </h2>
              <div className="prose-mora mt-5 space-y-4 text-[15px] leading-7 text-soft">{section.body}</div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
