"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSales } from "@/components/sales/SalesProvider";
import type { BoldCheckoutSession } from "@/payments/types";
import { payWithBold } from "./useBoldCheckout";
import { clearPendingPay, type PendingPay, writePendingPay } from "./pendingPay";
import { usePaymentWatch } from "./usePaymentWatch";

export function PaymentAwaiting({
  pending,
  onPending,
}: {
  pending: PendingPay;
  onPending: (next: PendingPay) => void;
}) {
  const sales = useSales();
  const router = useRouter();
  const watch = usePaymentWatch(pending.reference);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  const failed =
    watch.status === "declined" ||
    watch.status === "voided" ||
    watch.status === "error" ||
    Boolean(watch.error && !watch.intent);
  const approved = watch.status === "approved";
  const href =
    watch.intent?.redirectPath || `/pedido/${encodeURIComponent(pending.orderNumber)}`;

  useEffect(() => {
    if (!approved) return;
    clearPendingPay();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => router.replace(href), reduce ? 1200 : 2800);
    return () => window.clearTimeout(timer);
  }, [approved, href, router]);

  async function retry() {
    setRetrying(true);
    setRetryError("");
    try {
      const session = failed
        ? await resumeSession(pending.orderNumber)
        : pending.session;
      if (session.reference !== pending.reference) {
        const next = {
          orderNumber: pending.orderNumber,
          reference: session.reference,
          session,
        };
        writePendingPay(next);
        onPending(next);
      }
      await payWithBold(session);
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "No pudimos reabrir el pago.");
    } finally {
      setRetrying(false);
    }
  }

  if (approved) {
    return (
      <AwaitingCard
        kicker={`Pedido ${pending.orderNumber}`}
        title="Ya es tuyo."
        detail={sales.promise}
        action={
          <Link href={href} className="elegir-cta mt-8 inline-flex">
            Ver mi pedido
            <span aria-hidden className="elegir-cta-arrow">
              ›
            </span>
          </Link>
        }
      />
    );
  }

  if (failed) {
    return (
      <AwaitingCard
        kicker={`Pedido ${pending.orderNumber}`}
        title={watch.error ? "No se pudo confirmar" : "El pago no se completó"}
        detail={watch.error || retryError || "Puedes intentarlo otra vez."}
        action={
          <RetryButton retrying={retrying} failed onClick={() => void retry()} />
        }
      />
    );
  }

  return (
    <AwaitingCard
      kicker={`Pedido ${pending.orderNumber}`}
      title="Confirmando tu pago"
      detail={
        watch.timedOut
          ? "Aún no llega la confirmación. Si ya pagaste, espera un momento."
          : "Estamos esperando que el pago se haga efectivo. Nequi y PSE tardan un momento."
      }
      listening
      action={
        <div className="mt-8">
          {retryError ? (
            <p className="mb-3 text-[13px] leading-5 text-[#6e6e73]">{retryError}</p>
          ) : null}
          <RetryButton retrying={retrying} onClick={() => void retry()} />
        </div>
      }
    />
  );
}

function AwaitingCard({
  kicker,
  title,
  detail,
  action,
  listening = false,
}: {
  kicker: string;
  title: string;
  detail: string;
  action: ReactNode;
  listening?: boolean;
}) {
  return (
    <div className="check-card px-6 py-10 text-center sm:px-10">
      <p className="kicker">{kicker}</p>
      {listening ? (
        <span className="mx-auto mt-6 block h-2 w-2 animate-pulse rounded-full bg-[#1d1d1f]" />
      ) : null}
      <h1 className="title-name mt-5 text-[2rem] text-[#1d1d1f]">{title}</h1>
      <p className="mx-auto mt-3 max-w-[22rem] text-[15px] leading-6 text-[#6e6e73]">
        {detail}
      </p>
      {action}
    </div>
  );
}

function RetryButton({
  retrying,
  failed = false,
  onClick,
}: {
  retrying: boolean;
  failed?: boolean;
  onClick: () => void;
}) {
  if (failed) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={retrying}
        className="elegir-cta mt-8 inline-flex disabled:opacity-50"
      >
        {retrying ? "Abriendo el pago…" : "Intentar de nuevo"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={retrying}
      className="text-[15px] tracking-[-0.016em] text-[#6e6e73] underline underline-offset-4 hover:text-[#1d1d1f] disabled:opacity-50"
    >
      {retrying ? "Abriendo el pago…" : "¿Algo salió mal con el pago? Intentar de nuevo"}
    </button>
  );
}

async function resumeSession(orderNumber: string): Promise<BoldCheckoutSession> {
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
  return data.session;
}
