import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { SupportDesk, SupportWhatsApp } from "@/components/support/SupportDesk";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Soporte",
  description: "Preguntas frecuentes y una nota para Mora. Pedido, app o anillo.",
  alternates: { canonical: "/soporte" },
  openGraph: {
    title: `Soporte — ${BRAND.name}`,
    description: "Lo que suelen preguntar. Si hace falta, nos escribes.",
    url: siteUrl("/soporte"),
    locale: "es_CO",
  },
  robots: { index: true, follow: true },
};

const FAQ = [
  {
    q: "¿Mora es un dispositivo médico?",
    a: "No. Es bienestar. No diagnostica, no trata y no sustituye a un profesional de la salud.",
  },
  {
    q: "¿La app sirve sin anillo?",
    a: "Puedes recorrerla. Medir y sincronizar piden un Mora Pro o Mora Ultra.",
  },
  {
    q: "¿No encuentra el anillo?",
    a: "Bluetooth encendido, anillo cerca y con carga. Si sigue callado: desvincula y vuelve a vincular.",
  },
  {
    q: "¿El ciclo se sube a la nube?",
    a: "No. Ciclo e intimidad se quedan en el teléfono.",
  },
  {
    q: "¿Se conecta con Salud de Apple o Health Connect?",
    a: "Sí. En iPhone, Yo → Salud de Apple; en Android, Yo → Health Connect. Mora guarda pasos, pulso, oxígeno, sueño, entrenos y minutos de calma. Solo escribe; nunca lee tus datos de Salud ni de Health Connect.",
  },
  {
    q: "¿Cómo borro mi cuenta?",
    a: "En la app, Yo → Eliminar mi cuenta. También en moraring.com/app/eliminar-cuenta.",
  },
  {
    q: "¿Dónde está mi pedido?",
    a: "En Mi pedido, con el número del correo de confirmación.",
  },
  {
    q: "¿Cómo elijo la talla?",
    a: "Pides el medidor. Te llega primero, nos cuentas el número y enviamos el anillo. No hay cambio de talla después.",
  },
];

export default function SoportePage() {
  return (
    <div className="relative overflow-hidden" lang="es-CO">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Soporte", path: "/soporte" },
        ]}
      />
      <div className="hero-wash border-b border-line">
        <div className="mx-auto flex max-w-xl flex-col items-center px-6 pb-20 pt-16 text-center sm:pt-20">
          <div className="frame-in flex flex-col items-center">
            <BrandLogo variant="mark" className="h-14 w-14 object-contain drop-shadow-sm" priority />
            <p className="kicker mt-8">Soporte</p>
            <h1 className="display mt-3 text-[clamp(2.2rem,7vw,3.4rem)] leading-[1.04] text-ink">
              Estamos aquí.
            </h1>
            <p className="title-whisper mt-4 max-w-sm text-[clamp(1.05rem,2.8vw,1.2rem)] text-soft">
              Primero lo breve. Si hace falta, una nota.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-6 pb-8 pt-2 sm:pb-10">
        <section className="faq-list border-none">
          <h2 className="font-display text-[1.45rem] tracking-[-0.035em] text-ink">
            Lo que suelen preguntar
          </h2>
          <div className="mt-4 border-t border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>{item.q}</summary>
                <p>
                  {item.q === "¿Dónde está mi pedido?" ? (
                    <>
                      En{" "}
                      <Link href="/pedido" className="text-ink underline decoration-bloom/80 underline-offset-2">
                        Mi pedido
                      </Link>
                      , con el número del correo de confirmación.
                    </>
                  ) : item.q === "¿Cómo elijo la talla?" ? (
                    <>
                      Pides el{" "}
                      <Link href="/talla" className="text-ink underline decoration-bloom/80 underline-offset-2">
                        medidor
                      </Link>
                      . Te llega primero, nos cuentas el número y enviamos el anillo. No hay cambio de talla
                      después.
                    </>
                  ) : (
                    item.a
                  )}
                </p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <div className="mx-auto max-w-xl px-6 pb-24">
        <h2 className="font-display text-[1.45rem] tracking-[-0.035em] text-ink">Escríbenos</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-soft">
          Una nota. Te respondemos al correo.
        </p>
        <div className="mt-6">
          <SupportDesk />
        </div>
        <div className="mt-8">
          <SupportWhatsApp />
        </div>
      </div>
    </div>
  );
}
