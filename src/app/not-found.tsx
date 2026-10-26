import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppLink } from "@/components/growth/WhatsAppLink";
import { StatusPage } from "@/components/site/StatusPage";
import { productPath } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <StatusPage
      kicker="404"
      title="Esta página no existe."
      body="Puede que el enlace haya cambiado."
    >
      <Link href="/#coleccion" className="elegir-cta">
        Elegir mi Mora
        <span aria-hidden className="elegir-cta-arrow">
          ›
        </span>
      </Link>
      <nav aria-label="Seguir en Mora" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14px]">
        <Link href={productPath("aero")} className="text-ink/70 hover:text-ink">
          Mora Pro
        </Link>
        <Link href={productPath("titan")} className="text-ink/70 hover:text-ink">
          Mora Ultra
        </Link>
        <Link href="/pedido" className="text-ink/70 hover:text-ink">
          Mi pedido
        </Link>
        <WhatsAppLink className="text-ink/70 hover:text-ink">WhatsApp</WhatsAppLink>
      </nav>
    </StatusPage>
  );
}
