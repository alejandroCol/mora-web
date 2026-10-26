"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useSales } from "@/components/sales/SalesProvider";
import type { BoldCheckoutSession, PaymentIntentStatus, PaymentProvider } from "@/payments/types";
import { payWithBold } from "./useBoldCheckout";
import { paidDetail } from "./paidCopy";
import { readPendingPay, writePendingPay } from "./pendingPay";
import { PurchaseSeal } from "./PurchaseSeal";
import { usePaymentWatch, type WatchedIntent } from "./usePaymentWatch";

function destination(intent: WatchedIntent) {
  if (intent.redirectPath) return intent.redirectPath;
  const orderNumber = intent.metadata.orderNumber;
  if (orderNumber) return `/pedido/${encodeURIComponent(orderNumber)}`;
  return "/pedido";
}

function copyFor(
  status: PaymentIntentStatus | "waiting",
  paidNote: string,
  provider?: PaymentProvider,
  timedOut = false,
) {
  switch (status) {
    case "approved":
      return { title: "Ya es tuyo.", detail: paidDetail(paidNote) };
    case "declined":
      return {
        title: provider === "addi" ? "Addi no aprobó las cuotas" : "Pago rechazado",
        detail: "No se pudo cobrar. Puedes intentarlo otra vez.",
      };
    case "voided":
      return {
        title: provider === "addi" ? "Saliste de Addi" : "Pago anulado",
        detail: "Puedes volver al pedido e intentarlo otra vez.",
      };
    case "error":
      return { title: "No se pudo cobrar", detail: "Hubo un error. Inténtalo de nuevo." };
    case "pending":
      return {
        title: "Confirmando el pago",
        detail:
          provider === "addi"
            ? "Addi tarda un momento en confirmar las cuotas. No cierres esta pantalla."
            : timedOut
              ? "Aún no llega la confirmación. Si ya pagaste, espera un momento."
              : "Nequi y PSE tardan un momento. No cierres esta pantalla.",
      };
    default:
      return {
        title: "Confirmando el pago",
        detail: timedOut
          ? "Aún no llega la confirmación. Si ya pagaste, espera un momento."
          : "Estamos esperando que el pago se haga efectivo.",
      };
  }
}

function PaymentReturnInner() {
  const sales = useSales();
  const params = useSearchParams();
  const demo = params.get("demo") === "seal";
  const urlRef =
    params.get("bold-order-id") ??
    params.get("ref") ??
    params.get("orderId") ??
    params.get("order_id") ??
    "";
  const [stored, setStored] = useState<ReturnType<typeof readPendingPay>>(null);
  const [storeReady, setStoreReady] = useState(false);
  useEffect(() => {
    setStored(readPendingPay());
    setStoreReady(true);
  }, []);
  const reference = urlRef || stored?.reference || "";
  const watch = usePaymentWatch(demo || (!urlRef && !storeReady) ? null : reference || null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  const status = demo ? "approved" : watch.status;
  const intent = demo
    ? ({
        reference: "demo",
        status: "approved" as const,
        purpose: "order",
        redirectPath: "/pedido",
        metadata: { orderNumber: "MORA-000" },
      } satisfies WatchedIntent)
    : watch.intent;
  const copy = copyFor(status, sales.paidNote, intent?.provider, watch.timedOut);
  const orderNumber = intent?.metadata.orderNumber ?? stored?.orderNumber;
  const href = intent ? destination(intent) : orderNumber ? `/pedido/${orderNumber}` : "/pedido";
  const failed =
    status === "declined" ||
    status === "voided" ||
    status === "error" ||
    Boolean(watch.error && !watch.intent);
  const missingRef = !demo && storeReady && !reference;
  const canRetry = Boolean(orderNumber || stored) && intent?.provider !== "addi";

  async function retry() {
    if (!canRetry) return;
    setRetrying(true);
    setRetryError("");
    try {
      const reuse = stored && !failed ? stored.session : null;
      if (reuse) {
        await payWithBold(reuse);
        return;
      }
      if (!orderNumber) throw new Error("Falta el número de pedido.");
      const res = await fetch("/api/checkout/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, method: "bold" }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        session?: BoldCheckoutSession;
      };
      if (!data.ok || !data.session) {
        throw new Error(data.error ?? "No pudimos reabrir el pago.");
      }
      writePendingPay({
        orderNumber,
        reference: data.session.reference,
        session: data.session,
      });
      await payWithBold(data.session);
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "No pudimos reabrir el pago.");
    } finally {
      setRetrying(false);
    }
  }

  if (failed || missingRef) {
    return (
      <PurchaseSeal
        phase="fail"
        title={missingRef || watch.error || retryError ? "No se pudo confirmar" : copy.title}
        detail={missingRef ? "Falta la referencia del pago." : watch.error || retryError || copy.detail}
        failHref={intent || orderNumber ? href : "/checkout"}
        onRetry={canRetry ? () => void retry() : undefined}
        retrying={retrying}
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

  return (
    <PurchaseSeal
      phase="wait"
      title={copy.title}
      detail={retryError || copy.detail}
      onRetry={canRetry ? () => void retry() : undefined}
      retrying={retrying}
    />
  );
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
