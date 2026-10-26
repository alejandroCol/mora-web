"use client";

import Link from "next/link";
import { useEffect } from "react";
import { WhatsAppLink } from "@/components/growth/WhatsAppLink";
import { StatusPage } from "@/components/site/StatusPage";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    void import("firebase/analytics")
      .then(async ({ getAnalytics, isSupported, logEvent }) => {
        if (!(await isSupported())) return;
        const { getFirebaseApp } = await import("@/lib/firebase");
        logEvent(getAnalytics(getFirebaseApp()), "exception", {
          description: error.digest ?? "client",
          fatal: false,
        });
      })
      .catch(() => undefined);
  }, [error]);

  return (
    <StatusPage
      kicker="Error"
      title="Algo no cargó bien."
      body="Puedes intentar de nuevo. Si sigue igual, escríbenos."
    >
      <button type="button" onClick={() => retry()} className="elegir-cta">
        Intentar de nuevo
      </button>
      <div className="flex gap-5 text-[14px]">
        <Link href="/" className="text-ink/70 hover:text-ink">
          Ir al inicio
        </Link>
        <WhatsAppLink className="text-ink/70 hover:text-ink">WhatsApp</WhatsAppLink>
      </div>
    </StatusPage>
  );
}
