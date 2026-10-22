"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { TRACKING_STEPS, fulfillmentIndex } from "@/commerce/orderMachine";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/commerce/labels";
import type { OrderStatus, PaymentStatus } from "@/commerce/types";
import { payWithBold } from "@/components/payments/useBoldCheckout";
import type { BoldCheckoutSession } from "@/payments/types";
import { track } from "@/growth/track";
import { commerceLineLabel, orderNeedsSize, tallaPath } from "@/commerce/sizing";
import { formatMoney } from "@/lib/catalog";
import { useSales } from "@/components/sales/SalesProvider";

type PublicOrder = {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  canRetry?: boolean;
  expiresAt?: number | null;
  needsSize?: boolean;
  hasSizer?: boolean;
  sizerTrackingNumber?: string | null;
  items: {
    name: string;
    finishTitle: string;
    size: number;
    sizing?: "kit" | "self";
    qty: number;
  }[];
  ciudad: string;
  departamento: string;
  carrierLabel?: string;
  trackingNumber: string | null;
  deliveryEstimate: string | null;
  totals: { total: number; shipping: number };
  timeline: { status: OrderStatus; at: number }[];
  createdAt: number;
  paidAt: number | null;
  dispatchedAt: number | null;
  deliveredAt: number | null;
  purchaseEventId?: string | null;
};

async function fetchOrder(n: string) {
  const res = await fetch(`/api/orders/track?n=${encodeURIComponent(n)}`);
  return (await res.json()) as { ok: boolean; error?: string; order?: PublicOrder };
}

export function OrderTracker({
  initial,
  paymentRef,
}: {
  initial?: string;
  paymentRef?: string;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(initial));
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!paymentRef) return;
    void fetch("/api/payments/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: paymentRef }),
    }).catch(() => undefined);
  }, [paymentRef]);

  useEffect(() => {
    if (!initial) return;
    setValue(initial);
    setLoading(true);
    let cancelled = false;
    const started = Date.now();

    async function load(once: boolean) {
      const data = await fetchOrder(initial!);
      if (cancelled) return data.order ?? null;
      setLoading(false);
      if (!data.ok || !data.order) {
        if (once) {
          setError(data.error ?? "No encontramos ese pedido.");
          setOrder(null);
        }
        return null;
      }
      setError("");
      setOrder(data.order);
      return data.order;
    }

    void load(true).then(async (first) => {
      if (!first || first.status !== "awaiting_payment") return;
      while (!cancelled && Date.now() - started < 90_000) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const next = await load(false);
        if (!next || next.status !== "awaiting_payment") break;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [initial, paymentRef]);

  useEffect(() => {
    if (!order?.paidAt) return;
    const key = `mora-purchase-${order.orderNumber}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    track(
      "Purchase",
      {
        value: order.totals.total,
        currency: "COP",
        order_id: order.orderNumber,
        content_type: "product",
        num_items: order.items.reduce((sum, item) => sum + item.qty, 0),
      },
      undefined,
      order.purchaseEventId ?? undefined,
    );
  }, [order]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const n = value.trim().toUpperCase();
    if (!n) return;
    setLoading(true);
    setError("");
    const data = await fetchOrder(n);
    setLoading(false);
    if (!data.ok || !data.order) {
      setOrder(null);
      setError(data.error ?? "No encontramos ese pedido.");
      return;
    }
    setOrder(data.order);
  }

  return (
    <div className="mx-auto max-w-lg">
      <p className="kicker">Seguimiento</p>
      <h1 className="mt-3 text-[2rem] font-medium tracking-[-0.04em] text-ink sm:text-[2.4rem]">
        Tu pedido
      </h1>
      <p className="mt-2 text-[15px] leading-7 text-soft">
        Usa el número que te enviamos por correo. Sin cuentas, sin fricción.
      </p>

      <form onSubmit={(event) => void onSubmit(event)} className="reserve-sheet mt-8">
        <label className="reserve-row">
          <span>Número de pedido</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value.toUpperCase())}
            placeholder="MORA-1042"
            className="reserve-input font-medium tracking-[0.08em]"
            autoComplete="off"
          />
        </label>
        <div className="px-5 pb-5">
          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-full bg-ink text-[13px] text-white disabled:opacity-50"
          >
            {loading ? "Buscando…" : "Ver estado"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-6 rounded-2xl bg-white/70 px-4 py-3 text-sm text-soft">{error}</p>
      ) : null}

      {order ? (
        <OrderStatusCard
          order={order}
          paying={paying}
          onRetry={
            order.canRetry
              ? async () => {
                  setPaying(true);
                  setError("");
                  try {
                    const res = await fetch("/api/checkout/resume", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ orderNumber: order.orderNumber }),
                    });
                    const data = (await res.json()) as {
                      ok: boolean;
                      error?: string;
                      session?: BoldCheckoutSession;
                    };
                    if (!data.ok || !data.session) {
                      throw new Error(data.error ?? "No pudimos reabrir el pago.");
                    }
                    await payWithBold(data.session);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "El pago no se completó.");
                  } finally {
                    setPaying(false);
                  }
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function OrderStatusCard({
  order,
  onRetry,
  paying,
}: {
  order: PublicOrder;
  onRetry?: () => void;
  paying?: boolean;
}) {
  const sales = useSales();
  const index = fulfillmentIndex(order.status);
  const cancelled = order.status === "cancelled";
  const waitingPay = order.status === "awaiting_payment";

  return (
    <div className="receipt-sheet mt-10 rounded-[1.35rem] bg-white/70 px-5 py-6 sm:px-6 sm:py-7">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-line pb-5">
        <BrandLogo variant="mark" className="h-8 w-8 object-contain" />
        <p className="kicker">Recibo</p>
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="kicker">{order.orderNumber}</p>
          <p className="mt-2 text-[1.35rem] tracking-[-0.03em] text-ink">
            {ORDER_STATUS_LABEL[order.status]}
          </p>
          <p className="mt-1 text-[13px] text-soft">
            {order.ciudad}
            {order.departamento ? ` · ${order.departamento}` : ""}
          </p>
        </div>
        <p className="text-[14px] text-ink">{formatMoney(order.totals.total)}</p>
      </div>

      {waitingPay ? (
        <p className="mt-8 rounded-2xl bg-white/70 px-5 py-4 text-[14px] leading-6 text-soft">
          {order.paymentStatus === "pending"
            ? "Estamos confirmando el pago. Nequi y PSE tardan un momento."
            : order.paymentStatus
              ? `Pago ${PAYMENT_STATUS_LABEL[order.paymentStatus].toLowerCase()}.`
              : "Estamos esperando el pago."}
        </p>
      ) : null}

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={paying}
          className="mt-4 h-11 w-full rounded-full bg-ink text-[13px] text-white disabled:opacity-50"
        >
          {paying ? "Abriendo el pago…" : "Pagar otra vez"}
        </button>
      ) : null}

      {order.hasSizer ? (
        <div className="mt-6 rounded-[1.2rem] bg-white/80 px-5 py-5">
          <p className="kicker">Medidor</p>
          <p className="title-whisper mt-2 text-[1.25rem] text-ink">
            {order.status === "sizer_transit" ? "El medidor va en camino." : "Primero el medidor. Luego tu talla."}
          </p>
          <p className="mt-2 text-[13px] leading-6 text-soft">
            Cuando lo uses, entra con este pedido y pide el anillo. {sales.promise}
          </p>
          {order.sizerTrackingNumber ? (
            <p className="mt-2 text-[13px] text-ink">Guía del medidor {order.sizerTrackingNumber}</p>
          ) : null}
          <Link
            href={tallaPath(order.orderNumber)}
            className="mt-4 flex h-11 items-center justify-center rounded-full bg-ink text-[13px] text-white"
          >
            Pedir mi talla
          </Link>
        </div>
      ) : order.needsSize || orderNeedsSize(order.items) ? (
        <div className="mt-6 rounded-[1.2rem] bg-white/80 px-5 py-5">
          <p className="kicker">Medidor</p>
          <p className="title-whisper mt-2 text-[1.25rem] text-ink">
            Primero el medidor. Luego tu talla.
          </p>
          <p className="mt-2 text-[13px] leading-6 text-soft">
            Cuando lo uses, entra con este pedido y pide el anillo. {sales.promise}
          </p>
          <Link
            href={tallaPath(order.orderNumber)}
            className="mt-4 flex h-11 items-center justify-center rounded-full bg-ink text-[13px] text-white"
          >
            Pedir mi talla
          </Link>
        </div>
      ) : order.status === "paid" ? (
        <p className="mt-6 text-[13px] leading-6 text-soft">{sales.promise}</p>
      ) : null}

      {cancelled ? (
        <p className="mt-8 rounded-2xl bg-white/70 px-5 py-4 text-[14px] leading-6 text-soft">
          Este pedido fue cancelado. Si pagaste, escríbenos con el número de pedido.
        </p>
      ) : (
        <ol className="mt-8">
          {TRACKING_STEPS.map((step, i) => {
            const done = index >= i;
            const current = index === i;
            return (
              <li key={step.status} className="relative flex gap-4 pb-7 last:pb-0">
                {i < TRACKING_STEPS.length - 1 ? (
                  <span
                    className={`absolute left-[11px] top-7 h-[calc(100%-8px)] w-px ${
                      done && index > i ? "bg-ink" : "bg-ink/12"
                    }`}
                  />
                ) : null}
                <span
                  className={`relative z-[1] mt-0.5 h-[22px] w-[22px] rounded-full ${
                    done ? "bg-ink" : "border border-ink/20 bg-paper"
                  } ${current ? "ring-4 ring-lilac/80" : ""}`}
                />
                <div>
                  <p className={`text-[15px] ${done ? "text-ink" : "text-soft"}`}>
                    {step.label}
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-soft">{step.description}</p>
                  {step.status === "in_transit" && done && order.trackingNumber ? (
                    <p className="mt-2 text-[13px] text-ink">
                      Guía {order.trackingNumber}
                      {order.carrierLabel ? ` · ${order.carrierLabel}` : ""}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ul className="mt-8 divide-y divide-line text-[14px]">
        {order.items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex justify-between py-3">
            <span className="text-ink">
              {commerceLineLabel(item)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[12px] text-soft">{BRAND.tagline}</p>
    </div>
  );
}

function TrackerFromQuery() {
  const params = useSearchParams();
  const ref = params.get("ref") ?? params.get("n") ?? "";
  return <OrderTracker initial={ref || undefined} />;
}

export function PedidoIndexPage() {
  return (
    <div className="hero-wash min-h-dvh px-6 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-20">
      <Suspense>
        <TrackerFromQuery />
      </Suspense>
      <p className="mx-auto mt-12 max-w-lg text-center text-[12px] text-soft">
        <Link href="/" className="hover:text-ink">
          Volver a {BRAND.name}
        </Link>
      </p>
    </div>
  );
}

function PedidoNumberInner() {
  const params = useParams<{ orderNumber: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const n = decodeURIComponent(params.orderNumber ?? "");
  const paymentRef = search.get("bold-order-id") ?? search.get("ref") ?? undefined;

  useEffect(() => {
    if (n && !n.toUpperCase().startsWith("MORA-")) {
      router.replace(`/pedido?ref=${encodeURIComponent(n)}`);
    }
  }, [n, router]);

  return <OrderTracker initial={n.toUpperCase()} paymentRef={paymentRef} />;
}

export function PedidoNumberPage() {
  return (
    <div className="hero-wash min-h-dvh px-6 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-20">
      <Suspense>
        <PedidoNumberInner />
      </Suspense>
      <p className="mx-auto mt-12 max-w-lg text-center text-[12px] text-soft">
        <Link href="/" className="hover:text-ink">
          Volver a {BRAND.name}
        </Link>
      </p>
    </div>
  );
}
