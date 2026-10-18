"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { PRESALE } from "@/lib/presale";
import type { PaymentIntentStatus } from "@/payments/types";
import { PurchaseSeal } from "./PurchaseSeal";

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
      return { title: "Ya es tuyo.", detail: PRESALE.promise };
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
  const params = useSearchParams();
  const demo = params.get("demo") === "seal";
  const reference =
    params.get("bold-order-id") ?? params.get("ref") ?? params.get("orderId") ?? "";
  const [status, setStatus] = useState<PaymentIntentStatus | "waiting">(
    demo ? "approved" : "waiting",
  );
  const [error, setError] = useState("");
  const [intent, setIntent] = useState<IntentView | null>(
    demo
      ? {
          reference: "demo",
          status: "approved",
          purpose: "order",
          redirectPath: "/pedido",
          metadata: { orderNumber: "MORA-000" },
        }
      : null,
  );
  const synced = useRef(false);

  useEffect(() => {
    if (demo) return;
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
        if (
          data.intent.status === "approved" ||
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
  }, [reference, demo]);

  const copy = copyFor(status);
  const orderNumber = intent?.metadata.orderNumber;
  const href = intent ? destination(intent) : "/pedido";
  const failed =
    status === "declined" || status === "voided" || status === "error" || Boolean(error);

  if (failed) {
    return (
      <PurchaseSeal
        phase="fail"
        title={error ? "No se pudo confirmar" : copy.title}
        detail={error || copy.detail}
        failHref={intent ? href : "/checkout"}
      />
    );
  }

  if (status === "approved") {
    return (
      <PurchaseSeal
        phase="done"
        title={copy.title}
        detail={copy.detail}
        href={href}
        orderNumber={orderNumber}
      />
    );
  }

  return <PurchaseSeal phase="wait" title={copy.title} detail={copy.detail} />;
}

export function PaymentReturn() {
  return (
    <Suspense
      fallback={<PurchaseSeal phase="wait" title="Confirmando el pago" detail="Un momento." />}
    >
      <PaymentReturnInner />
    </Suspense>
  );
}
