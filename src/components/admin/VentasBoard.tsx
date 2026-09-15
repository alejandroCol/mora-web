"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/commerce/labels";
import type { MoraOrder, OrderStatus } from "@/commerce/types";
import { formatMoney } from "@/lib/catalog";
import { useAdminAuth } from "./AdminAuth";
import { ManualSaleForm } from "./ManualSaleForm";

const COLUMNS: { status: OrderStatus; hint: string }[] = [
  { status: "paid", hint: "Listos para despachar" },
  { status: "in_transit", hint: "Ya salieron" },
  { status: "delivered", hint: "Cerrados" },
];

export function VentasBoard() {
  const { authorizedFetch } = useAdminAuth();
  const [orders, setOrders] = useState<MoraOrder[]>([]);
  const [selected, setSelected] = useState<MoraOrder | null>(null);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/orders");
    const data = (await res.json()) as { ok: boolean; orders?: MoraOrder[] };
    if (data.ok) setOrders(data.orders ?? []);
  }, [authorizedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (!showCancelled && order.status === "cancelled") return false;
      if (!q) return true;
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        order.customer.firstName.toLowerCase().includes(q) ||
        order.customer.email.toLowerCase().includes(q) ||
        (order.shipping.trackingNumber ?? "").toLowerCase().includes(q)
      );
    });
  }, [orders, query, showCancelled]);

  async function changeStatus(order: MoraOrder, status: OrderStatus) {
    setBusy(true);
    try {
      const res = await authorizedFetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          trackingNumber: tracking || order.shipping.trackingNumber,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; order?: MoraOrder };
      if (!data.ok) throw new Error(data.error);
      setSelected(data.order ?? null);
      await load();
      setTracking("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Módulo de ventas</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.05em] text-[#f4f1ea]">
            Pedidos vivos.
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCancelled((value) => !value)}
            className="h-10 rounded-full px-4 text-[12px] text-white/50 hover:text-white"
          >
            {showCancelled ? "Ocultar cancelados" : "Ver cancelados"}
          </button>
          <button
            type="button"
            onClick={() => setManual(true)}
            className="h-10 rounded-full bg-white px-5 text-[13px] text-[#0e0d14]"
          >
            Venta manual
          </button>
        </div>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar número, cliente o guía"
        className="mt-8 h-12 w-full max-w-md rounded-full bg-white/6 px-5 text-sm text-white placeholder:text-white/30"
      />

      <div className="mt-8 grid gap-4 xl:grid-cols-3">
        {COLUMNS.map((column) => {
          const list = filtered.filter((order) => order.status === column.status);
          return (
            <section key={column.status} className="rounded-[1.6rem] bg-white/[0.04] p-4">
              <div className="flex items-baseline justify-between px-2">
                <h2 className="text-[15px]">{ORDER_STATUS_LABEL[column.status]}</h2>
                <span className="text-[12px] text-white/35">{list.length}</span>
              </div>
              <p className="mt-1 px-2 text-[12px] text-white/35">{column.hint}</p>
              <ul className="mt-4 space-y-2">
                {list.map((order) => (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(order);
                        setTracking(order.shipping.trackingNumber ?? "");
                      }}
                      className="w-full rounded-2xl bg-white/[0.05] p-4 text-left hover:bg-white/[0.08]"
                    >
                      <div className="flex justify-between gap-3">
                        <span className="font-medium tracking-[0.04em]">{order.orderNumber}</span>
                        <span className="text-[13px]">{formatMoney(order.totals.total)}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-white/55">
                        {order.customer.firstName} · {order.shipping.ciudad}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-white/35">
                        {PAYMENT_METHOD_LABEL[order.payment.method]} · {order.channel}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {showCancelled ? (
        <ul className="mt-6 space-y-2">
          {filtered
            .filter((order) => order.status === "cancelled")
            .map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => setSelected(order)}
                  className="w-full rounded-2xl bg-white/[0.03] px-4 py-3 text-left text-sm text-white/50"
                >
                  {order.orderNumber} · cancelado
                </button>
              </li>
            ))}
        </ul>
      ) : null}

      {filtered.some((order) => order.status === "awaiting_payment") ? (
        <div className="mt-8">
          <h2 className="text-[13px] text-white/40">Esperando pago</h2>
          <ul className="mt-2 space-y-2">
            {filtered
              .filter((order) => order.status === "awaiting_payment")
              .map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(order)}
                    className="w-full rounded-2xl bg-amber-200/10 px-4 py-3 text-left text-sm"
                  >
                    {order.orderNumber} · {formatMoney(order.totals.total)}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {selected ? (
        <OrderDrawer
          order={selected}
          tracking={tracking}
          setTracking={setTracking}
          busy={busy}
          onClose={() => setSelected(null)}
          onStatus={(status) => void changeStatus(selected, status)}
        />
      ) : null}

      {manual ? (
        <ManualSaleForm
          authorizedFetch={authorizedFetch}
          onClose={() => setManual(false)}
          onCreated={() => void load()}
        />
      ) : null}
    </div>
  );
}

function OrderDrawer({
  order,
  tracking,
  setTracking,
  busy,
  onClose,
  onStatus,
}: {
  order: MoraOrder;
  tracking: string;
  setTracking: (value: string) => void;
  busy: boolean;
  onClose: () => void;
  onStatus: (status: OrderStatus) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose}>
      <aside
        className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-[#14131c] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <BrandLogo variant="mark" className="h-7 w-7 object-contain" />
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">
            Recibo
          </p>
        </div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">
          {ORDER_STATUS_LABEL[order.status]}
        </p>
        <h2 className="mt-2 text-3xl tracking-[-0.04em]">{order.orderNumber}</h2>
        <p className="mt-2 text-sm text-white/55">
          {order.customer.firstName} {order.customer.lastName}
          <br />
          {order.customer.email}
          <br />
          {order.customer.phone}
        </p>
        <p className="mt-4 text-sm text-white/70">
          {order.shipping.direccion}
          <br />
          {order.shipping.ciudad}
        </p>
        <ul className="mt-6 space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.key} className="flex justify-between">
              <span>
                {item.name} · {item.finishTitle} · #{item.size} ×{item.qty}
              </span>
              <span>{formatMoney(item.unitPrice * item.qty)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-right text-lg">{formatMoney(order.totals.total)}</p>
        <p className="mt-1 text-right text-[12px] text-white/40">
          {PAYMENT_METHOD_LABEL[order.payment.method]}
          {order.payment.wompiPaymentType ? ` · ${order.payment.wompiPaymentType}` : ""}
        </p>

        {order.status === "paid" ? (
          <div className="mt-8">
            <label className="text-[11px] uppercase tracking-[0.12em] text-white/40">
              Número de guía
            </label>
            <input
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              placeholder="Opcional, se envía al cliente"
              className="mt-2 h-11 w-full rounded-2xl bg-white/8 px-3 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("in_transit")}
              className="mt-4 h-11 w-full rounded-full bg-white text-[13px] text-[#14131c] disabled:opacity-40"
            >
              Despachar pedido
            </button>
          </div>
        ) : null}

        {order.status === "in_transit" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus("delivered")}
            className="mt-8 h-11 w-full rounded-full bg-white text-[13px] text-[#14131c]"
          >
            Marcar entregado
          </button>
        ) : null}

        {order.status === "awaiting_payment" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus("paid")}
            className="mt-8 h-11 w-full rounded-full bg-white text-[13px] text-[#14131c]"
          >
            Marcar pagado
          </button>
        ) : null}

        {order.status !== "cancelled" && order.status !== "delivered" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus("cancelled")}
            className="mt-3 h-11 w-full rounded-full text-[13px] text-red-300 hover:bg-red-300/10"
          >
            Cancelar pedido
          </button>
        ) : null}
      </aside>
    </div>
  );
}
