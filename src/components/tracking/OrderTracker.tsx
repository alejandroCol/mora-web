"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { CartLineVisual } from "@/components/cart/CartLineVisual";
import { trackingSteps } from "@/commerce/orderMachine";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/commerce/labels";
import type { CatalogId, OrderStatus, PaymentStatus } from "@/commerce/types";
import { payWithBold } from "@/components/payments/useBoldCheckout";
import type { BoldCheckoutSession } from "@/payments/types";
import { track } from "@/growth/track";
import { orderNeedsSize, tallaPath } from "@/commerce/sizing";
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
  sizerStatus?: string | null;
  items: {
    kind?: "ring" | "case";
    modelId: CatalogId;
    finishId: string;
    name: string;
    finishTitle: string;
    size: number;
    sizing?: "kit" | "self";
    qty: number;
    unitPrice?: number;
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

/** «1050» o «mora 1050» → «MORA-1050». */
function normalizeOrderNumber(raw: string) {
  const value = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d+$/.test(value)) return `MORA-${value}`;
  const match = value.match(/^MORA-?(\d+)$/);
  return match ? `MORA-${match[1]}` : value;
}

function orderPath(orderNumber: string) {
  return `/pedido/${encodeURIComponent(orderNumber)}`;
}

function LookupForm({
  initial = "",
  onSame,
}: {
  initial?: string;
  onSame?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const n = normalizeOrderNumber(value);
    if (!n) {
      setError("Escribe el número de tu pedido. Está en el correo de confirmación.");
      return;
    }
    setError("");
    if (onSame && n === initial) {
      onSame();
      return;
    }
    setBusy(true);
    router.push(orderPath(n));
  }

  return (
    <>
      <form onSubmit={onSubmit} className="reserve-sheet mt-8">
        <label className="reserve-row">
          <span>Número de pedido</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value.toUpperCase())}
            placeholder="MORA-1042"
            className="reserve-input font-medium tracking-[0.08em]"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
        <div className="px-5 pb-5">
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-full bg-ink text-[13px] text-white disabled:opacity-50"
          >
            {busy ? "Buscando…" : "Ver estado"}
          </button>
        </div>
      </form>
      {error ? (
        <p className="mt-6 rounded-2xl bg-white/70 px-4 py-3 text-sm text-soft" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

export function OrderTracker({
  initial,
  paymentRef,
}: {
  initial: string;
  paymentRef?: string;
}) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paymentRef) return;
    void fetch("/api/payments/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: paymentRef }),
    }).catch(() => undefined);
  }, [paymentRef]);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    async function load(once: boolean) {
      const data = await fetchOrder(initial).catch(() => ({
        ok: false,
        error: "No pudimos consultar tu pedido. Inténtalo otra vez.",
        order: undefined,
      }));
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
  }, [initial, paymentRef, attempt]);

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

  const orderNumber = order?.orderNumber;
  useEffect(() => {
    if (!orderNumber || !resultRef.current) return;
    const top = resultRef.current.getBoundingClientRect().top;
    if (top > window.innerHeight * 0.6) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [orderNumber]);

  async function retryPay() {
    if (!order) return;
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

  return (
    <div className="mx-auto max-w-lg">
      <p className="kicker">Seguimiento</p>
      <h1 className="mt-3 text-[2rem] font-medium tracking-[-0.04em] text-ink sm:text-[2.4rem]">
        Tu pedido
      </h1>

      {loading ? (
        <div className="receipt-sheet mt-8 rounded-[1.35rem] bg-white/70 px-5 py-10 text-center">
          <span className="mx-auto block h-2 w-2 animate-pulse rounded-full bg-ink" />
          <p className="mt-4 text-[14px] text-soft">Buscando {initial}…</p>
        </div>
      ) : null}

      {!loading && !order ? (
        <>
          <LookupForm
            initial={initial}
            onSame={() => {
              setLoading(true);
              setError("");
              setAttempt((n) => n + 1);
            }}
          />
          {error ? (
            <p className="mt-6 rounded-2xl bg-white/70 px-4 py-3 text-sm text-soft" role="alert">
              {error}
            </p>
          ) : null}
        </>
      ) : null}

      {order ? (
        <div ref={resultRef} className="scroll-mt-24">
          {error ? (
            <p className="mt-6 rounded-2xl bg-white/70 px-4 py-3 text-sm text-soft" role="alert">
              {error}
            </p>
          ) : null}
          <OrderStatusCard
            order={order}
            paying={paying}
            onRetry={order.canRetry ? () => void retryPay() : undefined}
          />
          <p className="mt-6 text-center text-[13px] text-soft">
            <Link href="/pedido" className="underline underline-offset-4 hover:text-ink">
              Buscar otro pedido
            </Link>
          </p>
        </div>
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
  const cancelled = order.status === "cancelled";
  const waitingPay = order.status === "awaiting_payment";
  const needsSize = Boolean(order.needsSize || orderNeedsSize(order.items));
  const steps = trackingSteps({
    status: order.status,
    hasSizer: order.hasSizer,
    needsSize,
    sizerStatus: order.sizerStatus,
    deliveryLabel: sales.mode === "presale" ? sales.deliveryLabel : undefined,
  });
  const current = steps.findIndex((step) => !step.done);
  const sizerHeadline =
    order.sizerStatus === "delivered"
      ? "Tu medidor ya llegó. ¿Qué talla te quedó?"
      : order.status === "sizer_transit" || order.sizerStatus === "in_transit"
        ? "Tu medidor ya va en camino."
        : "Primero te enviamos el medidor.";

  return (
    <div className="receipt-sheet mt-8 rounded-[1.35rem] bg-white/70 px-5 py-6 sm:px-6 sm:py-7">
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
            ? "Estamos confirmando tu pago. Nequi y PSE tardan un momento."
            : order.paymentStatus
              ? `Pago ${PAYMENT_STATUS_LABEL[order.paymentStatus].toLowerCase()}.`
              : "Estamos esperando tu pago."}
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

      {!cancelled && !waitingPay && needsSize ? (
        <div className="mt-6 rounded-[1.2rem] bg-white/80 px-5 py-5">
          <p className="kicker">Medidor de tallas</p>
          <p className="title-whisper mt-2 text-[1.25rem] text-ink">
            {sizerHeadline}
          </p>
          <p className="mt-2 text-[13px] leading-6 text-soft">{sales.sizerNote}</p>
          {order.sizerTrackingNumber ? (
            <p className="mt-2 text-[13px] text-ink">Guía del medidor {order.sizerTrackingNumber}</p>
          ) : null}
          <Link
            href={tallaPath(order.orderNumber)}
            className="mt-4 flex h-11 items-center justify-center rounded-full bg-ink text-[13px] text-white"
          >
            Contarles mi talla
          </Link>
        </div>
      ) : null}

      {cancelled ? (
        <p className="mt-8 rounded-2xl bg-white/70 px-5 py-4 text-[14px] leading-6 text-soft">
          Este pedido fue cancelado. Si pagaste, escríbenos con el número de pedido y te ayudamos.
        </p>
      ) : (
        <ol className="mt-8">
          {steps.map((step, i) => {
            const next = steps[i + 1];
            return (
              <li key={step.key} className="relative flex gap-4 pb-7 last:pb-0">
                {next ? (
                  <span
                    className={`absolute left-[11px] top-7 h-[calc(100%-8px)] w-px ${
                      step.done && next.done ? "bg-ink" : "bg-ink/12"
                    }`}
                  />
                ) : null}
                <span
                  className={`relative z-[1] mt-0.5 h-[22px] w-[22px] shrink-0 rounded-full ${
                    step.done ? "bg-ink" : "border border-ink/20 bg-paper"
                  } ${i === current ? "ring-4 ring-lilac/80" : ""}`}
                />
                <div>
                  <p className={`text-[15px] ${step.done ? "text-ink" : "text-soft"}`}>
                    {step.label}
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-soft">{step.description}</p>
                  {step.key === "sizer_transit" && order.sizerTrackingNumber ? (
                    <p className="mt-2 text-[13px] text-ink">Guía {order.sizerTrackingNumber}</p>
                  ) : null}
                  {step.key === "in_transit" && step.done && order.trackingNumber ? (
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

      <ul className="mt-8 space-y-4 border-t border-line pt-6">
        {order.items.map((item, i) => (
          <li key={`${item.modelId}-${item.finishId}-${i}`}>
            <CartLineVisual
              line={item}
              price={item.unitPrice != null ? formatMoney(item.unitPrice * item.qty) : undefined}
            />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[12px] text-soft">{BRAND.tagline}</p>
    </div>
  );
}

function IndexInner() {
  const params = useSearchParams();
  const router = useRouter();
  const ref = params.get("ref") ?? params.get("n") ?? "";
  const n = ref ? normalizeOrderNumber(ref) : "";

  useEffect(() => {
    if (n.startsWith("MORA-")) router.replace(orderPath(n));
  }, [n, router]);

  return (
    <div className="mx-auto max-w-lg">
      <p className="kicker">Seguimiento</p>
      <h1 className="mt-3 text-[2rem] font-medium tracking-[-0.04em] text-ink sm:text-[2.4rem]">
        Tu pedido
      </h1>
      <LookupForm initial={n} />
    </div>
  );
}

export function PedidoIndexPage() {
  return (
    <div className="hero-wash min-h-dvh px-6 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-20">
      <Suspense>
        <IndexInner />
      </Suspense>
      <p className="mx-auto mt-12 max-w-lg text-center text-[12px] text-soft">
        <Link href="/" className="hover:text-ink">
          Volver a Mora Ring
        </Link>
      </p>
    </div>
  );
}

function PedidoNumberInner() {
  const params = useParams<{ orderNumber: string }>();
  const search = useSearchParams();
  const n = normalizeOrderNumber(decodeURIComponent(params.orderNumber ?? ""));
  const paymentRef = search.get("bold-order-id") ?? search.get("ref") ?? undefined;

  return <OrderTracker key={n} initial={n} paymentRef={paymentRef} />;
}

export function PedidoNumberPage() {
  return (
    <div className="hero-wash min-h-dvh px-6 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-20">
      <Suspense>
        <PedidoNumberInner />
      </Suspense>
      <p className="mx-auto mt-12 max-w-lg text-center text-[12px] text-soft">
        <Link href="/" className="hover:text-ink">
          Volver a Mora Ring
        </Link>
      </p>
    </div>
  );
}
