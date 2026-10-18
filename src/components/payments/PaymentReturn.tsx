"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { PaymentIntentStatus } from "@/payments/types";

type IntentView = {
  reference: string;
  status: PaymentIntentStatus;
  purpose: string;
  redirectPath: string;
  metadata: Record<string, string>;
};

const POLL_MS = 2500;
const POLL_FOR_MS = 90_000;

function destination(intent: IntentView) {
  if (intent.redirectPath) return intent.redirectPath;
  const orderNumber = intent.metadata.orderNumber;
  if (orderNumber) return `/pedido/${encodeURIComponent(orderNumber)}`;
  return "/pedido";
}

function copyFor(status: PaymentIntentStatus | "waiting") {
  switch (status) {
    case "approved":
      return { title: "Pago aprobado", detail: "Ya quedó. Te llevamos al pedido." };
    case "declined":
      return { title: "Pago rechazado", detail: "No se pudo cobrar. Puedes intentarlo otra vez." };
    case "voided":
      return { title: "Pago anulado", detail: "La transacción se anuló." };
    case "error":
      return { title: "No se pudo cobrar", detail: "Hubo un error. Inténtalo de nuevo." };
    case "pending":
      return {
        title: "Confirmando el pago",
        detail: "Nequi y PSE tardan un momento. No cierres esta pantalla.",
      };
    default:
      return { title: "Confirmando el pago", detail: "Estamos esperando la respuesta." };
  }
}

function PaymentReturnInner() {
  const router = useRouter();
  const params = useSearchParams();
  const reference =
    params.get("bold-order-id") ?? params.get("ref") ?? params.get("orderId") ?? "";
  const [status, setStatus] = useState<PaymentIntentStatus | "waiting">("waiting");
  const [error, setError] = useState("");
  const [intent, setIntent] = useState<IntentView | null>(null);
  const synced = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    async function syncOnce() {
      if (!reference || synced.current) return;
      const res = await fetch("/api/payments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; intent?: IntentView | null };
      if (cancelled) return;
      synced.current = data.ok;
      if (data.intent) {
        setIntent(data.intent);
        setStatus(data.intent.status);
      } else if (!data.ok) {
        setError(data.error ?? "No pudimos leer el pago.");
      }
    }

    async function poll() {
      if (!reference) {
        setError("Falta la referencia del pago.");
        return true;
      }
      const res = await fetch(`/api/payments/status?ref=${encodeURIComponent(reference)}`);
      const data = (await res.json()) as { ok: boolean; intent?: IntentView; error?: string };
      if (cancelled) return true;
      if (data.ok && data.intent) {
        setIntent(data.intent);
        setStatus(data.intent.status);
        if (data.intent.status === "approved") {
          router.replace(destination(data.intent));
          return true;
        }
        if (
          data.intent.status === "declined" ||
          data.intent.status === "voided" ||
          data.intent.status === "error"
        ) {
          return true;
        }
      }
      return Date.now() - started > POLL_FOR_MS;
    }

    void (async () => {
      try {
        await syncOnce();
      } catch {
        if (!cancelled) setError("No pudimos confirmar el pago todavía.");
      }
      let stop = false;
      while (!cancelled && !stop) {
        try {
          stop = await poll();
        } catch {
          stop = Date.now() - started > POLL_FOR_MS;
        }
        if (!stop) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reference, router]);

  const copy = copyFor(status);
  const retryHref = intent ? destination(intent) : "/checkout";

  return (
    <div className="mx-auto max-w-lg text-center">
      <p className="kicker">Pago</p>
      <h1 className="mt-3 text-[2rem] font-medium tracking-[-0.04em] text-ink sm:text-[2.4rem]">
        {copy.title}
      </h1>
      <p className="mt-2 text-[15px] leading-7 text-soft">{copy.detail}</p>
      {error ? <p className="mt-6 text-[13px] text-ink/60">{error}</p> : null}
      {status === "approved" || status === "pending" || status === "waiting" ? null : (
        <Link
          href={retryHref}
          className="mt-8 inline-flex h-11 items-center rounded-full bg-ink px-8 text-[13px] text-white"
        >
          Volver al pedido
        </Link>
      )}
    </div>
  );
}

export function PaymentReturn() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg text-center">
          <p className="text-[15px] text-soft">Confirmando el pago…</p>
        </div>
      }
    >
      <PaymentReturnInner />
    </Suspense>
  );
}
