"use client";

import Link from "next/link";
import { BRAND } from "@/brand";
import { FALLBACK_SALES, type SalesPresentation } from "@/commerce/sales";
import {
  LegalDocument,
  legalLink,
  type LegalCopy,
  type LegalSection,
} from "@/components/legal/LegalDocument";
import type { LegalLang } from "@/components/legal/lang";

const UPDATED = {
  es: "Última actualización · 22 de octubre de 2026",
  en: "Last updated · October 22, 2026",
} as const;

const CONTACT = BRAND.contact.email;
const LEGAL_NAME = "PALMAPAY S.A.S.";

function deliveryOn(lang: LegalLang, sales: SalesPresentation) {
  if (!sales.saleOn) return sales.deliveryLabel;
  return new Intl.DateTimeFormat(lang === "es" ? "es-CO" : "en-US", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
  }).format(new Date(`${sales.saleOn}T09:00:00-05:00`));
}

function spanish(sales: SalesPresentation): LegalCopy {
  const sections: LegalSection[] = [
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
            <Link href="/privacidad?lang=es" className={legalLink}>
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
                <strong className="font-medium text-ink">{deliveryOn("es", sales)}</strong>) forman parte
                de la oferta. Si cambia el calendario por causas logísticas o de fabricación, te
                avisaremos por el canal de contacto de tu pedido.
              </>
            ) : (
              <>
                La compra se confirma con el pago. Después despachamos tu anillo. Si hay un cambio
                logístico, te avisaremos por el canal de contacto de tu pedido.
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
        <>
          <p>
            Enviamos a todo Colombia. El costo se cotiza en el checkout según el destino. El riesgo de
            pérdida pasa a ti cuando la transportadora registra la entrega o según la ley aplicable. Revisa
            el paquete al recibirlo y escríbenos pronto si hay daño o faltante.
          </p>
          <p>
            El detalle de envíos, el medidor de talla y la garantía de un mes está en{" "}
            <Link href="/envios-y-garantia" className={legalLink}>
              envíos, cambios y garantía
            </Link>
            . No hay cambio de talla después del envío.
          </p>
        </>
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
          <Link href="/privacidad?lang=es" className={legalLink}>
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
          razonable (sin abuso, ingeniería inversa del servicio ni interferencia con otros usuarios).
          Puedes solicitar eliminación de cuenta en{" "}
          <Link href="/app/eliminar-cuenta" className={legalLink}>
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

  return {
    kicker: "Legal · Tienda",
    title: "Condiciones del servicio",
    lead: sales.termsLead,
    updated: UPDATED.es,
    navLabel: "En esta página",
    intro: (
      <p>
        Estas condiciones aplican a <strong className="font-medium text-ink">moraring.com</strong>, compras
        de anillos Mora, mensajes comerciales y servicios relacionados operados por {LEGAL_NAME}.
      </p>
    ),
    sections,
    footer: (
      <>
        <p className="text-[14px] leading-7 text-soft">
          Dudas legales o del pedido:{" "}
          <a href={`mailto:${CONTACT}`} className="font-medium text-ink underline decoration-bloom underline-offset-2">
            {CONTACT}
          </a>
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-[13px] font-medium text-ink/70">
          <Link href="/privacidad?lang=es" className="underline-offset-2 hover:text-ink hover:underline">
            Privacidad
          </Link>
          <Link href="/" className="underline-offset-2 hover:text-ink hover:underline">
            Volver a moraring.com
          </Link>
        </div>
      </>
    ),
  };
}

function english(sales: SalesPresentation): LegalCopy {
  const presale = sales.mode === "presale";
  const when = deliveryOn("en", sales);
  const sections: LegalSection[] = [
    {
      id: "quien",
      kicker: "01",
      title: "Who we are",
      body: (
        <>
          <p>
            <strong className="font-medium text-ink">{LEGAL_NAME}</strong>, commercially{" "}
            <strong className="font-medium text-ink">{BRAND.name}</strong>, operates this site,{" "}
            {presale ? "the smart ring pre-sale" : "the smart ring store"}, email and WhatsApp support,
            and the services described in the{" "}
            <Link href="/privacidad?lang=en" className={legalLink}>
              privacy policy
            </Link>
            .
          </p>
          <p>
            By using moraring.com, buying, writing to us, or linking the Mora Ring app, you accept these
            terms.
          </p>
        </>
      ),
    },
    {
      id: "producto",
      kicker: "02",
      title: "Product and wellness",
      body: (
        <p>
          Mora Ring is a <strong className="font-medium text-ink">wellness</strong> experience. Ring and
          app readings are not a medical diagnosis and do not replace professional advice. Use the product
          with your own judgment and consult a doctor if you have health questions.
        </p>
      ),
    },
    {
      id: presale ? "preventa" : "compra",
      kicker: "03",
      title: presale ? "Pre-sale and delivery" : "Purchase and delivery",
      body: (
        <>
          <p>
            {presale ? (
              <>
                The pre-sale and delivery dates published on the site (including the expected delivery on{" "}
                <strong className="font-medium text-ink">{when}</strong>) are part of the offer. If the
                schedule changes for logistics or manufacturing reasons, we will tell you through the
                contact channel on your order.
              </>
            ) : (
              <>
                The purchase is confirmed when payment succeeds. We then ship your ring. If there is a
                logistics change, we will tell you through the contact channel on your order.
              </>
            )}
          </p>
          <p>
            You must confirm size and shipping details when we ask. An order without a confirmed size may
            be delayed until that information is complete.
          </p>
        </>
      ),
    },
    {
      id: "pagos",
      kicker: "04",
      title: "Prices, payments, and taxes",
      body: (
        <>
          <p>
            Prices in COP include applicable taxes unless checkout says otherwise. Payment is processed by
            authorized providers (for example Bold); we do not store your full card number.
          </p>
          <p>
            A sale is confirmed when payment is approved and you receive confirmation on screen or by
            email. We may cancel orders involving fraud, an obvious price error, or inconsistent details,
            and refund the amount paid when that applies.
          </p>
        </>
      ),
    },
    {
      id: "envios",
      kicker: "05",
      title: "Shipping and risk",
      body: (
        <>
          <p>
            We ship throughout Colombia. The cost is quoted at checkout based on the destination. Risk of
            loss passes to you when the carrier records delivery, or as applicable law provides. Check the
            package when it arrives and write to us promptly if something is damaged or missing.
          </p>
          <p>
            Shipping details, the size kit, and the one-month warranty are in{" "}
            <Link href="/envios-y-garantia" className={legalLink}>
              shipping, exchanges, and warranty
            </Link>
            . There is no size exchange after the ring ships.
          </p>
        </>
      ),
    },
    {
      id: "whatsapp",
      kicker: "06",
      title: "WhatsApp and messages",
      body: (
        <p>
          If you write to us on commercial WhatsApp, we use your number and messages to guide you through
          a purchase or order, as described in the{" "}
          <Link href="/privacidad?lang=en" className={legalLink}>
            privacy policy
          </Link>
          . Do not send sensitive clinical information in chat; the channel is commercial, not medical.
        </p>
      ),
    },
    {
      id: "cuenta",
      kicker: "07",
      title: "Account, Círculo, and the app",
      body: (
        <p>
          Using the app, Círculo, and cloud features may require an account and reasonable-use rules (no
          abuse, no reverse engineering of the service, and no interference with other users). You can
          request account deletion at{" "}
          <Link href="/app/eliminar-cuenta" className={legalLink}>
            moraring.com/app/eliminar-cuenta
          </Link>
          .
        </p>
      ),
    },
    {
      id: "propiedad",
      kicker: "08",
      title: "Intellectual property",
      body: (
        <p>
          Trademarks, designs, text, software, and site content belong to Mora or its licensors. You may
          not copy them or use them commercially without written permission.
        </p>
      ),
    },
    {
      id: "ley",
      kicker: "09",
      title: "Governing law and changes",
      body: (
        <>
          <p>
            These terms are governed by the laws of the{" "}
            <strong className="font-medium text-ink">Republic of Colombia</strong>. Any dispute will be
            submitted to the competent courts in Colombia, except where mandatory consumer rules require
            another venue.
          </p>
          <p>
            We may update these terms by posting the revision date on this page. Continued use of the
            service after a change means you have read the current version.
          </p>
        </>
      ),
    },
  ];

  return {
    kicker: "Legal · Store",
    title: "Terms of service",
    lead: presale
      ? "Pre-sale, payments, delivery, wellness (not medical), and commercial contact."
      : "Purchases, payments, shipping, and commercial contact in Colombia.",
    updated: UPDATED.en,
    navLabel: "On this page",
    intro: (
      <p>
        These terms apply to <strong className="font-medium text-ink">moraring.com</strong>, purchases of
        Mora rings, commercial messages, and related services operated by {LEGAL_NAME}.
      </p>
    ),
    sections,
    footer: (
      <>
        <p className="text-[14px] leading-7 text-soft">
          Legal or order questions:{" "}
          <a href={`mailto:${CONTACT}`} className="font-medium text-ink underline decoration-bloom underline-offset-2">
            {CONTACT}
          </a>
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-[13px] font-medium text-ink/70">
          <Link href="/privacidad?lang=en" className="underline-offset-2 hover:text-ink hover:underline">
            Privacy
          </Link>
          <Link href="/" className="underline-offset-2 hover:text-ink hover:underline">
            Back to moraring.com
          </Link>
        </div>
      </>
    ),
  };
}

export function TerminosBody({ initial }: { initial: LegalLang }) {
  const sales = FALLBACK_SALES;
  return <LegalDocument initial={initial} copy={{ es: spanish(sales), en: english(sales) }} />;
}
