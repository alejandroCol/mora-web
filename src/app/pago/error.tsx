"use client";

import Link from "next/link";
import { WhatsAppLink } from "@/components/growth/WhatsAppLink";
import { StatusPage } from "@/components/site/StatusPage";

export default function PagoError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <StatusPage
      kicker="Pago"
      title="No pudimos mostrar el pago."
      body="Tu pedido, si ya se creó, sigue en Mi pedido."
    >
      <button type="button" onClick={() => retry()} className="elegir-cta">
        Intentar de nuevo
      </button>
      <div className="flex gap-5 text-[14px]">
        <Link href="/pedido" className="text-ink/70 hover:text-ink">
          Mi pedido
        </Link>
        <WhatsAppLink className="text-ink/70 hover:text-ink">WhatsApp</WhatsAppLink>
      </div>
    </StatusPage>
  );
}
