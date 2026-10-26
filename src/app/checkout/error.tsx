"use client";

import Link from "next/link";
import { WhatsAppLink } from "@/components/growth/WhatsAppLink";
import { StatusPage } from "@/components/site/StatusPage";

export default function CheckoutError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <StatusPage
      kicker="Checkout"
      title="No pudimos abrir el pago."
      body="Tu carrito sigue guardado en este teléfono."
    >
      <button type="button" onClick={() => retry()} className="elegir-cta">
        Volver al checkout
      </button>
      <WhatsAppLink className="text-[14px] text-ink/70 hover:text-ink">WhatsApp</WhatsAppLink>
      <Link href="/" className="text-[14px] text-ink/70 hover:text-ink">
        Ir al inicio
      </Link>
    </StatusPage>
  );
}
