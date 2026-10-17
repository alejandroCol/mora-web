import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { siteUrl } from "@/lib/site";

const CONTACT = "hola@mora.ring";
const UPDATED = "17 de octubre de 2026";

export const metadata: Metadata = {
  title: "Borrar tu cuenta Mora Ring",
  description:
    "Cómo pedir que borremos tu cuenta de Mora Ring y los datos del Círculo. Qué se elimina, qué se queda en el teléfono y cuánto tarda.",
  alternates: { canonical: "/app/eliminar-cuenta" },
  openGraph: {
    title: `Borrar tu cuenta — ${BRAND.name}`,
    description: "Pasos para borrar tu cuenta de Mora Ring y los datos asociados en la nube.",
    url: siteUrl("/app/eliminar-cuenta"),
    locale: "es_CO",
  },
  robots: { index: true, follow: true },
};

export default function EliminarCuentaAppPage() {
  return (
    <div className="relative overflow-hidden" lang="es">
      <div className="hero-wash border-b border-line">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-16 text-center sm:pt-20">
          <BrandLogo variant="mark" className="h-14 w-14 object-contain drop-shadow-sm" priority />
          <BrandLogo
            variant="wordmark"
            className="mt-5 h-7 w-auto max-w-[min(100%,220px)] object-contain opacity-90"
            alt=""
          />
          <p className="kicker mt-8">Mora Ring · Cuenta</p>
          <h1 className="display mt-3 text-[clamp(2.1rem,6vw,3.25rem)] leading-[1.06] text-ink">
            Borrar tu cuenta de Mora Ring
          </h1>
          <p className="title-whisper mt-4 max-w-lg text-[clamp(1.05rem,2.8vw,1.25rem)] text-soft">
            Delete your Mora Ring account and associated Círculo data.
          </p>
          <p className="mt-6 text-[13px] text-soft">Actualizado · {UPDATED}</p>
        </div>
      </div>

      <article className="mx-auto max-w-2xl space-y-5 px-6 pb-28 pt-10 sm:space-y-6">
        <section className="reserve-sheet border border-line-strong/40 p-6 sm:p-8">
          <p className="text-[15px] leading-7 text-soft">
            Esta página es para la app <strong className="font-medium text-ink">Mora Ring</strong>{" "}
            (Android e iOS), publicada por <strong className="font-medium text-ink">Mora</strong>.
            Sirve para pedir que borremos tu <strong className="font-medium text-ink">cuenta</strong>{" "}
            y los datos que guardamos en la nube del Círculo.
          </p>
        </section>

        <section className="reserve-sheet border border-line-strong/30 p-6 sm:p-8">
          <p className="kicker">01</p>
          <h2 className="mt-2 font-display text-[1.45rem] tracking-[-0.03em] text-ink sm:text-[1.65rem]">
            Cómo pedir el borrado
          </h2>
          <p className="mt-2 text-[13px] text-soft">How to request account deletion</p>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-[15px] leading-7 text-soft">
            <li>
              Escribe a{" "}
              <a
                href={`mailto:${CONTACT}?subject=${encodeURIComponent("Borrar cuenta Mora Ring")}`}
                className="font-medium text-ink underline decoration-bloom underline-offset-2"
              >
                {CONTACT}
              </a>{" "}
              con el asunto <strong className="font-medium text-ink">Borrar cuenta Mora Ring</strong>.
            </li>
            <li>Usa el mismo correo con el que entras al Círculo.</li>
            <li>
              Confirmamos la petición y borramos la cuenta. Lo hacemos en cuanto podemos, como
              máximo en <strong className="font-medium text-ink">30 días</strong>.
            </li>
          </ol>
          <p className="mt-5 text-[15px] leading-7 text-soft">
            En iPhone, dentro de Mora Ring:{" "}
            <strong className="font-medium text-ink">Yo → Cuenta Mora → Cerrar y borrar mi nube</strong>.
            En Android, por ahora usa el correo de arriba.
          </p>
        </section>

        <section className="reserve-sheet border border-line-strong/30 p-6 sm:p-8">
          <p className="kicker">02</p>
          <h2 className="mt-2 font-display text-[1.45rem] tracking-[-0.03em] text-ink sm:text-[1.65rem]">
            Qué borramos
          </h2>
          <p className="mt-2 text-[13px] text-soft">Data we delete</p>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-[15px] leading-7 text-soft">
            <li>La cuenta (correo y acceso a Firebase Authentication).</li>
            <li>Tu sitio en el Círculo e invitaciones que hayas creado.</li>
            <li>Resúmenes del día que hayas subido (pasos, noche, marea).</li>
            <li>Registros del anillo guardados en la nube y ligados a esa cuenta.</li>
          </ul>
        </section>

        <section className="reserve-sheet border border-line-strong/30 p-6 sm:p-8">
          <p className="kicker">03</p>
          <h2 className="mt-2 font-display text-[1.45rem] tracking-[-0.03em] text-ink sm:text-[1.65rem]">
            Qué se queda
          </h2>
          <p className="mt-2 text-[13px] text-soft">Data we keep</p>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-[15px] leading-7 text-soft">
            <li>
              Lo que solo vive en el teléfono (ciclo, intimidad, historial completo del anillo). Eso
              no está en nuestra nube. Para quitarlo: borra los datos de la app o desinstálala.
            </li>
            <li>
              Pedidos de la tienda mora.ring, si los hay, el tiempo que pida la ley fiscal.
            </li>
            <li>
              Copias de seguridad técnicas, hasta <strong className="font-medium text-ink">180 días</strong>{" "}
              después de borrar la cuenta en vivo.
            </li>
          </ul>
        </section>

        <footer className="reserve-sheet border border-line-strong/30 p-6 text-center sm:p-8">
          <p className="text-[14px] leading-7 text-soft">
            ¿Dudas?{" "}
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
              mora.ring
            </Link>
          </div>
        </footer>
      </article>
    </div>
  );
}
