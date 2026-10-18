"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { orderNeedsSize, sizeCopy } from "@/commerce/sizing";
import type { OrderStatus } from "@/commerce/types";
import { PRESALE } from "@/lib/presale";
import { products } from "@/lib/catalog";

type PublicItem = {
  name: string;
  finishTitle: string;
  size: number;
  sizing?: "kit" | "self";
  qty: number;
  sizes?: number[];
};

type PublicOrder = {
  orderNumber: string;
  status: OrderStatus;
  needsSize?: boolean;
  items: PublicItem[];
};

const FALLBACK_SIZES = [6, 7, 8, 9, 10, 11, 12, 13];

async function fetchOrder(n: string) {
  const res = await fetch(`/api/orders/track?n=${encodeURIComponent(n)}`);
  return (await res.json()) as { ok: boolean; error?: string; order?: PublicOrder };
}

export function SizeRequest({ initial }: { initial?: string }) {
  const [value, setValue] = useState(initial ?? "");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(initial));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

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
      setPicks(data.order.items.map((item) => item.size || 8));
      setDone(!orderNeedsSize(data.order.items) && data.order.items.some((item) => item.size));
    });
  }, [initial]);

  async function onLookup(event: FormEvent) {
    event.preventDefault();
    const n = value.trim().toUpperCase();
    if (!n) return;
    setLoading(true);
    setError("");
    setDone(false);
    const data = await fetchOrder(n);
    setLoading(false);
    if (!data.ok || !data.order) {
      setOrder(null);
      setError(data.error ?? "No encontramos ese pedido.");
      return;
    }
    setOrder(data.order);
    setPicks(data.order.items.map((item) => item.size || 8));
  }

  async function onConfirm(event: FormEvent) {
    event.preventDefault();
    if (!order) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/orders/size", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber: order.orderNumber,
        sizes: order.items.map((_, index) => ({ index, size: picks[index] })),
      }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string; order?: PublicOrder };
    setSaving(false);
    if (!data.ok || !data.order) {
      setError(data.error ?? "No pudimos guardar la talla.");
      return;
    }
    setOrder(data.order);
    setDone(true);
  }

  const pending = order ? orderNeedsSize(order.items) : false;
  const locked =
    order?.status === "cancelled" ||
    order?.status === "in_transit" ||
    order?.status === "delivered";

  return (
    <div className="mx-auto max-w-lg">
      <p className="presale-seal">{PRESALE.label}</p>
      <h1 className="title-whisper mt-5 text-[clamp(2rem,7vw,3.1rem)] leading-[1.08] text-ink">
        Tu talla.
      </h1>
      <p className="mt-3 text-[15px] leading-7 text-soft">
        Con el número de pedido pides el anillo. El medidor ya viajó, o viaja primero.
        El precio no cambia.
      </p>

      <form onSubmit={(event) => void onLookup(event)} className="reserve-sheet mt-8">
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
            {loading ? "Buscando…" : "Abrir pedido"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-6 rounded-2xl bg-white/70 px-4 py-3 text-sm text-soft">{error}</p>
      ) : null}

      {order ? (
        <form
          onSubmit={(event) => void onConfirm(event)}
          className="mt-10 rounded-[1.35rem] bg-white/70 px-5 py-6 sm:px-6 sm:py-7"
        >
          <p className="kicker">{order.orderNumber}</p>
          {done || (!pending && !locked) ? (
            <p className="title-whisper mt-3 text-[1.35rem] text-ink">
              Talla lista. {PRESALE.promise}
            </p>
          ) : locked ? (
            <p className="mt-3 text-[15px] leading-7 text-soft">
              Este pedido ya no admite un cambio de talla.
            </p>
          ) : (
            <p className="title-whisper mt-3 text-[1.35rem] text-ink">
              Elige el número y lo pedimos.
            </p>
          )}

          <ul className="mt-6 space-y-6">
            {order.items.map((item, index) => {
              const sizes = item.sizes?.length ? item.sizes : FALLBACK_SIZES;
              const canPick = pending && !locked && (item.sizing ?? "self") === "kit";
              return (
                <li key={`${item.name}-${index}`}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-[15px] text-ink">
                      {item.name} · {item.finishTitle}
                    </p>
                    <p className="text-[13px] text-soft">{sizeCopy(item)}</p>
                  </div>
                  {canPick ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {sizes.map((size) => {
                        const active = picks[index] === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() =>
                              setPicks((current) =>
                                current.map((value, i) => (i === index ? size : value)),
                              )
                            }
                            className={`min-h-9 min-w-9 rounded-full px-2.5 text-[13px] transition-colors ${
                              active
                                ? "bg-ink text-white"
                                : "text-soft hover:bg-white hover:text-ink"
                            }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {pending && !locked ? (
            <button
              type="submit"
              disabled={saving}
              className="mt-8 h-12 w-full rounded-full bg-ink text-[13px] text-white disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Pedir esta talla"}
            </button>
          ) : (
            <Link
              href={`/pedido/${order.orderNumber}`}
              className="mt-8 flex h-12 items-center justify-center rounded-full bg-ink text-[13px] text-white"
            >
              Ver mi pedido
            </Link>
          )}
        </form>
      ) : null}

      <p className="mt-4 text-[12px] text-soft">
        {Object.values(products)
          .map((item) => `Mora ${item.name}`)
          .join(" · ")}
      </p>
    </div>
  );
}

function SizeFromRoute() {
  const params = useParams<{ orderNumber: string }>();
  const router = useRouter();
  const n = decodeURIComponent(params.orderNumber ?? "").toUpperCase();

  useEffect(() => {
    if (n && !n.startsWith("MORA-")) {
      router.replace(`/talla?n=${encodeURIComponent(n)}`);
    }
  }, [n, router]);

  return <SizeRequest initial={n} />;
}

export function TallaIndexPage() {
  return (
    <div className="hero-wash min-h-dvh px-6 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-20">
      <SizeRequest />
      <p className="mx-auto mt-12 max-w-lg text-center text-[12px] text-soft">
        <Link href="/" className="hover:text-ink">
          Volver a Mora
        </Link>
      </p>
    </div>
  );
}

export function TallaNumberPage() {
  return (
    <div className="hero-wash min-h-dvh px-6 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-20">
      <Suspense>
        <SizeFromRoute />
      </Suspense>
      <p className="mx-auto mt-12 max-w-lg text-center text-[12px] text-soft">
        <Link href="/" className="hover:text-ink">
          Volver a Mora
        </Link>
      </p>
    </div>
  );
}
