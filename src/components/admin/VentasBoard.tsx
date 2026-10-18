"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ORDER_CHANNEL_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/commerce/labels";
import type { MoraOrder, OrderStatus } from "@/commerce/types";
import { commerceLineLabel, orderNeedsSize } from "@/commerce/sizing";
import { formatMoney } from "@/lib/catalog";
import { useAdminAuth } from "./AdminAuth";
import { ManualSaleForm } from "./ManualSaleForm";

type Tab = "pipeline" | "awaiting_payment" | "delivered" | "cancelled" | "all";

const PIPELINE: { status: OrderStatus; hint: string; action: string }[] = [
  { status: "paid", hint: "Pagados, listos para salir", action: "Despachar" },
  { status: "in_transit", hint: "Con guía o en transporte", action: "Marcar entregado" },
  { status: "delivered", hint: "Cerrados y entregados", action: "Ver detalle" },
];

function ago(at: number) {
  const diff = Math.max(0, Date.now() - at);
  const hours = Math.round(diff / 3_600_000);
  if (hours < 1) return "hace minutos";
  if (hours < 48) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

function formatWhen(at: number) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

export function VentasBoard() {
  const { authorizedFetch } = useAdminAuth();
  const [orders, setOrders] = useState<MoraOrder[]>([]);
  const [selected, setSelected] = useState<MoraOrder | null>(null);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("pipeline");
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

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid").length;
    const transit = orders.filter((o) => o.status === "in_transit").length;
    const awaiting = orders.filter((o) => o.status === "awaiting_payment").length;
    const revenue = orders
      .filter((o) => o.status !== "cancelled" && o.status !== "awaiting_payment")
      .reduce((sum, o) => sum + o.totals.total, 0);
    const needsSize = orders.filter((o) => o.status === "paid" && orderNeedsSize(o.items)).length;
    return { paid, transit, awaiting, revenue, needsSize };
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (tab === "pipeline" && !["paid", "in_transit"].includes(order.status)) return false;
      if (tab === "awaiting_payment" && order.status !== "awaiting_payment") return false;
      if (tab === "delivered" && order.status !== "delivered") return false;
      if (tab === "cancelled" && order.status !== "cancelled") return false;
      if (!q) return true;
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        order.customer.firstName.toLowerCase().includes(q) ||
        order.customer.lastName.toLowerCase().includes(q) ||
        order.customer.email.toLowerCase().includes(q) ||
        order.customer.phone.includes(q) ||
        (order.shipping.trackingNumber ?? "").toLowerCase().includes(q)
      );
    });
  }, [orders, query, tab]);

  const selectedFresh = useMemo(
    () => orders.find((o) => o.id === selected?.id) ?? selected,
    [orders, selected],
  );

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

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "pipeline", label: "Por despachar", count: stats.paid + stats.transit },
    { id: "awaiting_payment", label: "Esperando pago", count: stats.awaiting },
    { id: "delivered", label: "Entregados" },
    { id: "cancelled", label: "Cancelados" },
    { id: "all", label: "Todos" },
  ];

  return (
    <div className="ventas-app">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Operación</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.05em] text-[#f4f1ea]">Ventas.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
            Pedidos pagados, envíos y cierre. Un pedido, un estado, una acción clara.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/superadmin/carritos"
            className="h-10 rounded-full bg-white/8 px-4 text-[12px] leading-10 text-white/55"
          >
            Carritos abandonados
          </Link>
          <button
            type="button"
            onClick={() => setManual(true)}
            className="h-10 rounded-full bg-white px-5 text-[13px] text-[#0e0d14]"
          >
            Venta manual
          </button>
        </div>
      </header>

      <div className="ventas-kpis">
        <Kpi label="Por despachar" value={String(stats.paid)} hint="Pagados sin salir" />
        <Kpi label="En camino" value={String(stats.transit)} hint="Con guía o en ruta" />
        <Kpi
          label="Esperando pago"
          value={String(stats.awaiting)}
          hint={stats.awaiting ? "Revisar hoy" : "Nada pendiente"}
          alert={stats.awaiting > 0}
        />
        <Kpi label="Ingresos (activos)" value={formatMoney(stats.revenue)} hint="Sin cancelados" />
      </div>

      {stats.needsSize > 0 ? (
        <p className="rounded-2xl border border-amber-200/40 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          {stats.needsSize} pedido(s) pagado(s) esperan talla antes de despachar.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-3 py-1.5 text-[12px] ${
              tab === item.id ? "bg-[#1d1d1f] text-white" : "bg-white/8 text-white/55"
            }`}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 ? ` · ${item.count}` : ""}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar pedido, cliente, teléfono o guía"
        className="h-11 w-full max-w-lg rounded-full bg-white/8 px-4 text-[13px] outline-none"
      />

      {tab === "pipeline" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {PIPELINE.filter((col) => col.status !== "delivered").map((column) => {
            const list = filtered.filter((order) => order.status === column.status);
            return (
              <section key={column.status} className="ventas-column">
                <div className="flex items-baseline justify-between px-1">
                  <div>
                    <h2 className="text-[15px] font-medium">{ORDER_STATUS_LABEL[column.status]}</h2>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{column.hint}</p>
                  </div>
                  <span className="text-[12px] text-[var(--admin-muted)]">{list.length}</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {list.length === 0 ? (
                    <li className="rounded-2xl bg-[var(--admin-field)] px-4 py-6 text-[13px] text-[var(--admin-muted)]">
                      Vacío
                    </li>
                  ) : (
                    list.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        action={column.action}
                        onOpen={() => {
                          setSelected(order);
                          setTracking(order.shipping.trackingNumber ?? "");
                        }}
                      />
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.length === 0 ? (
            <li className="rounded-[1.25rem] bg-white px-5 py-8 text-[14px] text-[var(--admin-muted)] shadow-[var(--admin-shadow)]">
              Nada en esta vista.
            </li>
          ) : (
            filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onOpen={() => {
                  setSelected(order);
                  setTracking(order.shipping.trackingNumber ?? "");
                }}
              />
            ))
          )}
        </ul>
      )}

      {selectedFresh ? (
        <OrderDrawer
          order={selectedFresh}
          tracking={tracking}
          setTracking={setTracking}
          busy={busy}
          onClose={() => setSelected(null)}
          onStatus={(status) => void changeStatus(selectedFresh, status)}
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

function Kpi({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <div className={`ventas-kpi ${alert ? "is-alert" : ""}`}>
      <p className="text-[11px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">{hint}</p>
    </div>
  );
}

function OrderCard({
  order,
  action,
  onOpen,
}: {
  order: MoraOrder;
  action?: string;
  onOpen: () => void;
}) {
  const pendingSize = order.status === "paid" && orderNeedsSize(order.items);
  return (
    <li>
      <button type="button" onClick={onOpen} className="ventas-row w-full text-left">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium tracking-[0.02em]">{order.orderNumber}</p>
            <p className="mt-1 text-[14px]">
              {order.customer.firstName} {order.customer.lastName}
            </p>
            <p className="mt-1 text-[13px] text-[var(--admin-muted)]">
              {order.shipping.ciudad || "Sin ciudad"} · {ORDER_CHANNEL_LABEL[order.channel]}
            </p>
            <p className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--admin-muted)]">
              <span>{PAYMENT_METHOD_LABEL[order.payment.method]}</span>
              <span>·</span>
              <span>{ago(order.updatedAt)}</span>
              {order.shipping.trackingNumber ? (
                <>
                  <span>·</span>
                  <span>Guía {order.shipping.trackingNumber}</span>
                </>
              ) : null}
              {pendingSize ? (
                <>
                  <span>·</span>
                  <span className="text-amber-800">Talla pendiente</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-medium">{formatMoney(order.totals.total)}</p>
            {action ? (
              <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                {action}
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-[var(--admin-muted)]">
                {ORDER_STATUS_LABEL[order.status]}
              </p>
            )}
          </div>
        </div>
      </button>
    </li>
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
  const pendingSize = order.status === "paid" && orderNeedsSize(order.items);
  const phone = order.customer.phone.replace(/\D/g, "");
  const crmHref =
    order.conversationId || phone
      ? `/superadmin/crm?c=${order.conversationId || (phone.startsWith("57") ? phone : `57${phone}`)}`
      : null;

  return (
    <div className="admin-drawer-backdrop" onClick={onClose}>
      <aside className="admin-drawer" onClick={(event) => event.stopPropagation()}>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--admin-muted)]">
          {ORDER_STATUS_LABEL[order.status]}
        </p>
        <h2 className="mt-2 font-display text-3xl tracking-[-0.04em]">{order.orderNumber}</h2>
        <p className="mt-1 text-[13px] text-[var(--admin-muted)]">
          {ORDER_CHANNEL_LABEL[order.channel]} · {formatWhen(order.createdAt)}
        </p>

        <section className="mt-6 rounded-2xl bg-[var(--admin-field)] p-4 text-[13px]">
          <p className="font-medium">
            {order.customer.firstName} {order.customer.lastName}
          </p>
          <p className="mt-1 text-[var(--admin-muted)]">{order.customer.email || "Sin correo"}</p>
          <p className="text-[var(--admin-muted)]">{order.customer.phone || "Sin teléfono"}</p>
          <p className="mt-3">
            {order.shipping.direccion || "Sin dirección"}
            <br />
            {order.shipping.ciudad}
            {order.shipping.departamento ? `, ${order.shipping.departamento}` : ""}
          </p>
        </section>

        <ul className="mt-6 space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.key} className="flex justify-between gap-3">
              <span>{commerceLineLabel(item)}</span>
              <span>{formatMoney(item.unitPrice * item.qty)}</span>
            </li>
          ))}
        </ul>
        {order.totals.discount ? (
          <p className="mt-2 text-right text-[12px] text-[var(--admin-muted)]">
            Descuento{order.meta?.offerCode ? ` · ${order.meta.offerCode}` : ""} −
            {formatMoney(order.totals.discount)}
          </p>
        ) : null}
        <p className="mt-3 text-right text-lg font-medium">{formatMoney(order.totals.total)}</p>
        <p className="mt-1 text-right text-[12px] text-[var(--admin-muted)]">
          {PAYMENT_METHOD_LABEL[order.payment.method]}
          {order.payment.boldPaymentType ?? order.payment.wompiPaymentType
            ? ` · ${order.payment.boldPaymentType ?? order.payment.wompiPaymentType}`
            : ""}
        </p>

        {order.timeline.length > 0 ? (
          <ul className="mt-6 space-y-2 border-t border-[var(--admin-line)] pt-4">
            {order.timeline.slice(-4).map((event, index) => (
              <li key={`${event.at}-${index}`} className="text-[12px] text-[var(--admin-muted)]">
                {ORDER_STATUS_LABEL[event.status]} · {formatWhen(event.at)}
                {event.note ? ` · ${event.note}` : ""}
              </li>
            ))}
          </ul>
        ) : null}

        {order.status === "paid" ? (
          <div className="mt-8">
            <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              Guía de envío
            </label>
            <input
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              placeholder="Coordinadora, Servientrega…"
              className="mt-2 h-11 w-full rounded-2xl bg-[var(--admin-field)] px-3 text-sm outline-none"
            />
            {pendingSize ? (
              <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-950">
                Falta confirmar talla. Envía el medidor antes de despachar.
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy || pendingSize}
              onClick={() => onStatus("in_transit")}
              className="admin-cta mt-4 h-11 w-full disabled:opacity-40"
            >
              Marcar en camino
            </button>
          </div>
        ) : null}

        {order.status === "in_transit" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus("delivered")}
            className="admin-cta mt-8 h-11 w-full"
          >
            Marcar entregado
          </button>
        ) : null}

        {order.status === "awaiting_payment" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus("paid")}
            className="admin-cta mt-8 h-11 w-full"
          >
            Confirmar pago recibido
          </button>
        ) : null}

        {crmHref ? (
          <Link
            href={crmHref}
            className="mt-3 flex h-11 items-center justify-center rounded-full bg-[var(--admin-field)] text-[13px]"
          >
            Ver chat en CRM
          </Link>
        ) : null}

        {order.status !== "cancelled" && order.status !== "delivered" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus("cancelled")}
            className="mt-3 h-11 w-full rounded-full text-[13px] text-[var(--admin-danger)] hover:bg-red-50"
          >
            Cancelar pedido
          </button>
        ) : null}
      </aside>
    </div>
  );
}
