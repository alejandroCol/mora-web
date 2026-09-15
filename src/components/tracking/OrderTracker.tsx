"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { TRACKING_STEPS, fulfillmentIndex } from "@/commerce/orderMachine";
import { ORDER_STATUS_LABEL } from "@/commerce/labels";
import type { OrderStatus } from "@/commerce/types";
import { track } from "@/growth/track";
import { formatMoney } from "@/lib/catalog";

type PublicOrder = {
  orderNumber: string;
  status: OrderStatus;
  items: { name: string; finishTitle: string; size: number; qty: number }[];
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

export function OrderTracker({ initial }: { initial?: string }) {
  const [value, setValue] = useState(initial ?? "");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(initial));

  useEffect(() => {
    if (!initial) return;
    setValue(initial);
    setLoading(true);
    void fetchOrder(initial).then((data) => {
      setLoading(false);
      if (!data.ok || !data.order) {
        setError(data.error ?? "No encontramos ese pedido.");
        setOrder(null);
        return;
      }
      setError("");
      setOrder(data.order);
    });
  }, [initial]);

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

      {order ? <OrderStatusCard order={order} /> : null}
    </div>
  );
}

function OrderStatusCard({ order }: { order: PublicOrder }) {
  const index = fulfillmentIndex(order.status);
  const cancelled = order.status === "cancelled";

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
              {item.name} · {item.finishTitle} · #{item.size}
              {item.qty > 1 ? ` ×${item.qty}` : ""}
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

export function PedidoNumberPage() {
  const params = useParams<{ orderNumber: string }>();
  const router = useRouter();
  const n = decodeURIComponent(params.orderNumber ?? "");

  useEffect(() => {
    if (n && !n.toUpperCase().startsWith("MORA-")) {
      router.replace(`/pedido?ref=${encodeURIComponent(n)}`);
    }
  }, [n, router]);

  return (
    <div className="hero-wash min-h-dvh px-6 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-20">
      <OrderTracker initial={n.toUpperCase()} />
      <p className="mx-auto mt-12 max-w-lg text-center text-[12px] text-soft">
        <Link href="/" className="hover:text-ink">
          Volver a {BRAND.name}
        </Link>
      </p>
    </div>
  );
}
