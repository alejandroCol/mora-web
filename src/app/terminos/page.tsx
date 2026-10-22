import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { BRAND } from "@/brand";
import { FALLBACK_SALES, type SalesPresentation } from "@/commerce/sales";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { siteUrl } from "@/lib/site";

const UPDATED = "22 de octubre de 2026";
const CONTACT = "hola@mora.ring";
const LEGAL_NAME = "PALMAPAY S.A.S.";

export function generateMetadata(): Metadata {
  const sales = FALLBACK_SALES;
  return {
    title: "Condiciones del servicio",
    description:
      "Términos de uso de moraring.com, la tienda Mora Ring, WhatsApp comercial y servicios relacionados en Colombia.",
    alternates: { canonical: "/terminos" },
    openGraph: {
      title: `Condiciones del servicio — ${BRAND.name}`,
      description: sales.termsLead,
      url: siteUrl("/terminos"),
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

function legalSections(sales: SalesPresentation): Section[] {
  return [
  {
    id: "quien",
    kicker: "01",
    title: "Quién somos",
    body: (
      <>
        <p>
          <strong className="font-medium text-ink">{LEGAL_NAME}</strong>, comercialmente{" "}
          <strong className="font-medium text-ink">{BRAND.name}</strong>, opera este sitio,{" "}
          {sales.termsWho}, el soporte por correo y WhatsApp, y los servicios descritos en{" "}
          <Link href="/privacidad" className="text-ink underline decoration-bloom/80 underline-offset-2">
            la política de privacidad
          </Link>
          .
        </p>
        <p>
          Al usar moraring.com, comprar, escribirnos o vincular la app Mora Ring, aceptas estas
          condiciones.
        </p>
      </>
    ),
  },
  {
    id: "producto",
    kicker: "02",
    title: "Producto y bienestar",
    body: (
      <p>
        Mora Ring es una experiencia de <strong className="font-medium text-ink">bienestar</strong>.
        Las lecturas del anillo y de la app no son diagnóstico médico ni sustituyen consejo
        profesional. Usa el producto con criterio propio y consulta a tu médico ante dudas de salud.
      </p>
    ),
  },
  {
    id: sales.mode === "presale" ? "preventa" : "compra",
    kicker: "03",
    title: sales.termsTitle,
    body: (
      <>
        <p>
          {sales.mode === "presale" ? (
            <>
              Las fechas de preventa y entrega publicadas en el sitio (incluida la entrega prevista el{" "}
              <strong className="font-medium text-ink">{sales.deliveryLabel}</strong>) forman parte de
              la oferta. Si cambia el calendario por causas logísticas o de fabricación, te avisaremos
              por el canal de contacto de tu pedido.
            </>
          ) : (
            <>
              La compra se confirma con el pago. El anillo se fabrica y se envía después. Si hay un
              cambio logístico o de fabricación, te avisaremos por el canal de contacto de tu pedido.
            </>
          )}
        </p>
        <p>
          Debes confirmar talla y datos de envío cuando te lo pidamos. Un pedido sin talla confirmada
          puede retrasarse hasta completar la información.
        </p>
      </>
    ),
  },
  {
    id: "pagos",
    kicker: "04",
    title: "Precios, pagos e impuestos",
    body: (
      <>
        <p>
          Los precios en COP incluyen los impuestos aplicables salvo que el checkout indique lo
          contrario. El pago se procesa mediante proveedores autorizados (p. ej. Bold); no almacenamos
          el número completo de tu tarjeta.
        </p>
        <p>
          Una venta se confirma cuando el pago es aprobado y recibes la confirmación en pantalla o por
          correo. Nos reservamos el derecho de cancelar pedidos con fraude, error manifiesto de precio o
          datos inconsistentes, reembolsando el valor pagado cuando corresponda.
        </p>
      </>
    ),
  },
  {
    id: "envios",
    kicker: "05",
    title: "Envíos y riesgo",
    body: (
      <p>
        El envío se cotiza en el checkout según destino en Colombia. El riesgo de pérdida pasa a ti cuando
        la transportadora registra la entrega o según la ley aplicable. Revisa el paquete al recibirlo y
        escríbenos pronto si hay daño o faltante.
      </p>
    ),
  },
  {
    id: "whatsapp",
    kicker: "06",
    title: "WhatsApp y mensajes",
    body: (
      <p>
        Si nos escribes por WhatsApp comercial, trataremos tu número y mensajes para orientarte en la
        compra o el pedido, según la{" "}
        <Link href="/privacidad" className="text-ink underline decoration-bloom/80 underline-offset-2">
          política de privacidad
        </Link>
        . No envíes por chat información clínica sensible; el canal es comercial, no médico.
      </p>
    ),
  },
  {
    id: "cuenta",
    kicker: "07",
    title: "Cuenta, Círculo y app",
    body: (
      <p>
        El uso de la app, Círculo y funciones en la nube puede requerir cuenta y cumplir reglas de uso
        razonable (sin abuso, ingeniería inversa del servicio ni interferencia con otros usuarios). Puedes
        solicitar eliminación de cuenta en{" "}
        <Link
          href="/app/eliminar-cuenta"
          className="text-ink underline decoration-bloom/80 underline-offset-2"
        >
          moraring.com/app/eliminar-cuenta
        </Link>
        .
      </p>
    ),
  },
  {
    id: "propiedad",
    kicker: "08",
    title: "Propiedad intelectual",
    body: (
      <p>
        Marcas, diseños, textos, software y contenido del sitio pertenecen a Mora o sus licenciantes. No
        puedes copiarlos ni usarlos comercialmente sin autorización escrita.
      </p>
    ),
  },
  {
    id: "ley",
    kicker: "09",
    title: "Ley aplicable y cambios",
    body: (
      <>
        <p>
          Estas condiciones se rigen por la legislación de la{" "}
          <strong className="font-medium text-ink">República de Colombia</strong>. Cualquier controversia
          se someterá a los jueces competentes en Colombia, salvo normas imperativas de consumidor que
          indiquen otro fuero.
        </p>
        <p>
          Podemos actualizar estos términos publicando la fecha de revisión en esta página. El uso
          continuado del servicio después del cambio implica que leíste la versión vigente.
        </p>
      </>
    ),
  },
  ];
}

export default function TerminosPage() {
  const sales = FALLBACK_SALES;
  const sections = legalSections(sales);

  return (
    <div className="relative overflow-hidden" lang="es-CO">
      <div className="hero-wash border-b border-line">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-28 pt-16 text-center sm:pt-20">
          <div className="frame-in flex flex-col items-center">
            <BrandLogo variant="mark" className="h-14 w-14 object-contain drop-shadow-sm" priority />
            <BrandLogo
              variant="wordmark"
              className="mt-5 h-7 w-auto max-w-[min(100%,220px)] object-contain opacity-90"
              alt=""
            />
            <p className="kicker mt-8">Legal · Tienda</p>
            <h1 className="display mt-3 text-[clamp(2.1rem,6vw,3.25rem)] leading-[1.06] text-ink">
              Condiciones del servicio
            </h1>
            <p className="title-whisper mt-4 max-w-lg text-[clamp(1.05rem,2.8vw,1.25rem)] text-soft">
              {sales.termsLead}
            </p>
            <p className="mt-6 text-[13px] text-soft">Última actualización · {UPDATED}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-24 pt-0 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-14 lg:pb-32">
        <nav
          aria-label="En esta página"
          className="frame-in reserve-sheet sticky top-6 z-10 hidden h-fit p-5 lg:block"
          style={{ animationDelay: "80ms" }}
        >
          <p className="kicker mb-4">En esta página</p>
          <ul className="space-y-2 text-[13px]">
            {sections.map((section) => (
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
          <div
            className="frame-in reserve-sheet border border-line-strong/40 p-6 sm:p-8"
            style={{ animationDelay: "120ms" }}
          >
            <p className="text-[15px] leading-7 text-soft">
              Estas condiciones aplican a <strong className="font-medium text-ink">moraring.com</strong>,
              compras de anillos Mora, mensajes comerciales y servicios relacionados operados por{" "}
              {LEGAL_NAME}.
            </p>
          </div>

          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="frame-in scroll-mt-28 reserve-sheet border border-line-strong/30 p-6 sm:p-8"
              style={{ animationDelay: `${160 + index * 40}ms` }}
            >
              <p className="kicker">{section.kicker}</p>
              <h2 className="mt-2 font-display text-[1.45rem] tracking-[-0.03em] text-ink sm:text-[1.65rem]">
                {section.title}
              </h2>
              <div className="prose-mora mt-5 space-y-4 text-[15px] leading-7 text-soft">
                {section.body}
              </div>
            </section>
          ))}

          <footer
            className="frame-in reserve-sheet border border-line-strong/30 p-6 text-center sm:p-8"
            style={{ animationDelay: `${160 + sections.length * 40}ms` }}
          >
            <p className="text-[14px] leading-7 text-soft">
              Dudas legales o del pedido:{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="font-medium text-ink underline decoration-bloom underline-offset-2"
              >
                {CONTACT}
              </a>
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-[13px] font-medium text-ink/70">
              <Link href="/privacidad" className="underline-offset-2 hover:text-ink hover:underline">
                Privacidad
              </Link>
              <Link href="/" className="underline-offset-2 hover:text-ink hover:underline">
                Volver a moraring.com
              </Link>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
