"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ORDER_CHANNEL_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/commerce/labels";
import type { CommerceSettings, MoraOrder, OrderStatus } from "@/commerce/types";
import { commerceLineLabel, orderHasSizer, orderNeedsSize } from "@/commerce/sizing";
import { enCaminoTarget, guideKindFor } from "@/commerce/shipments";
import { orderJourney } from "@/commerce/orderJourney";
import { formatMoney } from "@/lib/catalog";
import { useAdminAuth } from "./AdminAuth";
import { ManualSaleForm } from "./ManualSaleForm";

type Tab = "pipeline" | "awaiting_payment" | "delivered" | "cancelled" | "all";

const PIPELINE: { id: "ready" | "transit"; hint: string; statuses: OrderStatus[] }[] = [
  { id: "ready", hint: "Pagados, listos para salir", statuses: ["paid"] },
  { id: "transit", hint: "Medidor o anillos en transporte", statuses: ["sizer_transit", "in_transit"] },
];

function ago(at: number) {
  const diff = Math.max(0, Date.now() - at);
  const hours = Math.round(diff / 3_600_000);
  if (hours < 1) return "hace minutos";
  if (hours < 48) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

function guideNumberFor(order: MoraOrder, kind: "sizer" | "rings", typed = "") {
  const sizer = order.shipments?.sizer?.trackingNumber?.trim() || "";
  const rings = order.shipments?.rings?.trackingNumber?.trim() || "";
  const manual = typed.trim();
  if (kind === "sizer") {
    if (sizer) return sizer;
    if (manual && manual !== rings) return manual;
    return "";
  }
  if (rings) return rings;
  if (manual && manual !== sizer) return manual;
  const shipping = order.shipping.trackingNumber?.trim() || "";
  if (shipping && shipping !== sizer && order.shipping.hekaGuideId !== order.shipments?.sizer?.hekaGuideId) {
    return shipping;
  }
  return "";
}

/** Guía que ya existe para el tramo que toca marcar; vacío si no hay (no arrastrar la del medidor). */
function pendingGuideFor(order: MoraOrder) {
  const target = enCaminoTarget(order);
  return target ? guideNumberFor(order, target.kind) : "";
}

/** Ruedita dentro del botón mientras corre su acción. */
function Spin({ on }: { on: boolean }) {
  return on ? <span className="btn-spin" aria-hidden /> : null;
}

function CheckGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
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
  const [busy, setBusy] = useState("");
  const [hekaError, setHekaError] = useState("");
  const [sandbox, setSandbox] = useState(true);
  const [settings, setSettings] = useState<CommerceSettings | null>(null);

  const load = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/orders");
    const data = (await res.json()) as { ok: boolean; orders?: MoraOrder[] };
    if (data.ok) setOrders(data.orders ?? []);
  }, [authorizedFetch]);

  useEffect(() => {
    void load();
    void authorizedFetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data: { ok?: boolean; settings?: CommerceSettings }) => {
        if (data.ok && data.settings) {
          setSettings(data.settings);
          setSandbox(data.settings.hekaSandbox !== false);
        }
      })
      .catch(() => undefined);
  }, [authorizedFetch, load]);

  async function setProduction(on: boolean) {
    if (!settings) return;
    const next = { ...settings, hekaSandbox: !on };
    setSettings(next);
    setSandbox(next.hekaSandbox);
    await authorizedFetch("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(next),
    });
  }

  async function viewGuide(order: MoraOrder, leg?: "sizer" | "rings") {
    setBusy(`${order.id}:view:${leg ?? "rings"}`);
    setHekaError("");
    try {
      const res = await authorizedFetch(
        `/api/admin/orders/${order.id}/heka/label${leg ? `?leg=${leg}` : ""}`,
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "No se pudo abrir la guía.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setHekaError(error instanceof Error ? error.message : "No se pudo abrir la guía.");
    } finally {
      setBusy("");
    }
  }

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid").length;
    const transit = orders.filter((o) => o.status === "in_transit" || o.status === "sizer_transit").length;
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
      if (tab === "pipeline" && !["paid", "sizer_transit", "in_transit"].includes(order.status)) return false;
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

  async function runHeka(order: MoraOrder, action: "create" | "refresh") {
    setBusy(`${order.id}:heka:${action}`);
    setHekaError("");
    try {
      const res = await authorizedFetch(`/api/admin/orders/${order.id}/heka`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; order?: MoraOrder };
      if (!data.ok) throw new Error(data.error);
      setSelected(data.order ?? null);
      if (data.order?.shipping.trackingNumber) setTracking(data.order.shipping.trackingNumber);
      await load();
    } catch (error) {
      setHekaError(error instanceof Error ? error.message : "Heka no pudo crear la guía.");
    } finally {
      setBusy("");
    }
  }

  async function changeStatus(order: MoraOrder, status: OrderStatus, trackingNumber?: string) {
    setBusy(`${order.id}:status:${status}`);
    try {
      const res = await authorizedFetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          trackingNumber: trackingNumber || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; order?: MoraOrder };
      if (!data.ok) throw new Error(data.error);
      setSelected(data.order ?? null);
      await load();
      setTracking("");
    } catch (error) {
      setHekaError(error instanceof Error ? error.message : "No se pudo cambiar el estado.");
    } finally {
      setBusy("");
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

      {settings ? (
        <label className="flex items-start gap-3 rounded-2xl bg-white/[0.05] px-4 py-3 text-sm text-white/80">
          <input
            type="checkbox"
            className="mt-1"
            checked={!sandbox}
            onChange={(event) => void setProduction(event.target.checked)}
          />
          <span>
            Usar Heka de producción
            <span className="mt-1 block text-[12px] leading-5 text-white/45">
              {sandbox
                ? "Ahora las guías salen en el ambiente demo."
                : "Ahora las guías salen en producción y descuentan la billetera."}
            </span>
          </span>
        </label>
      ) : null}
      {hekaError ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-900">{hekaError}</p>
      ) : null}

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
          {PIPELINE.map((column) => {
            const list = filtered.filter((order) => column.statuses.includes(order.status));
            return (
              <section key={column.id} className="ventas-column">
                <div className="flex items-baseline justify-between px-1">
                  <div>
                    <h2 className="text-[15px] font-medium">
                      {column.id === "ready" ? "Por despachar" : "En camino"}
                    </h2>
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
                        busy={busy}
                        onOpen={() => {
                          setSelected(order);
                          setTracking(pendingGuideFor(order));
                          setHekaError("");
                        }}
                        onCreate={() => void runHeka(order, "create")}
                        onView={(leg) => void viewGuide(order, leg)}
                        onEnCamino={() => {
                          const target = enCaminoTarget(order);
                          if (!target) return;
                          void changeStatus(order, target.to, guideNumberFor(order, target.kind));
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
                busy={busy}
                onOpen={() => {
                  setSelected(order);
                  setTracking(pendingGuideFor(order));
                  setHekaError("");
                }}
                onCreate={() => void runHeka(order, "create")}
                onView={(leg) => void viewGuide(order, leg)}
                onEnCamino={() => {
                  const target = enCaminoTarget(order);
                  if (!target) return;
                  void changeStatus(order, target.to, guideNumberFor(order, target.kind));
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
          hekaError={hekaError}
          onClose={() => setSelected(null)}
          onStatus={(status) => void changeStatus(selectedFresh, status)}
          onHeka={(action) => void runHeka(selectedFresh, action)}
          onView={(leg) => void viewGuide(selectedFresh, leg)}
          onEnCamino={() => {
            const target = enCaminoTarget(selectedFresh);
            if (!target) return;
            void changeStatus(selectedFresh, target.to, guideNumberFor(selectedFresh, target.kind, tracking));
          }}
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
  busy,
  onOpen,
  onCreate,
  onView,
  onEnCamino,
}: {
  order: MoraOrder;
  busy: string;
  onOpen: () => void;
  onCreate: () => void;
  onView: (leg?: "sizer" | "rings") => void;
  onEnCamino: () => void;
}) {
  const pendingSize = orderNeedsSize(order.items);
  const guide = guideKindFor(order);
  const camino = enCaminoTarget(order);
  const sizerGuide = order.shipments?.sizer?.hekaGuideId;
  const ringsGuide =
    order.shipments?.rings?.hekaGuideId ||
    (order.shipping.hekaGuideId && order.shipping.hekaGuideId !== sizerGuide
      ? order.shipping.hekaGuideId
      : undefined);
  return (
    <li className="ventas-row">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
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
                  <span className="text-amber-800">Esperando talla</span>
                </>
              ) : null}
            </p>
        </button>
          <div className="flex flex-col items-end gap-2">
            <p className="text-[15px] font-medium">{formatMoney(order.totals.total)}</p>
            <p className="text-[11px] text-[var(--admin-muted)]">{ORDER_STATUS_LABEL[order.status]}</p>
            {guide ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={onCreate}
                className="h-9 rounded-full bg-[#1d1d1f] px-4 text-[12px] text-white disabled:opacity-40"
              >
                <Spin on={busy === `${order.id}:heka:create`} />
                {guide === "sizer"
                  ? "Guía del medidor"
                  : orderHasSizer(order.items)
                    ? "Guía de los anillos"
                    : "Crear guía"}
              </button>
            ) : null}
            {camino ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={onEnCamino}
                className="h-9 rounded-full bg-[#1d1d1f] px-4 text-[12px] text-white disabled:opacity-40"
              >
                <Spin on={busy === `${order.id}:status:${camino.to}`} />
                {camino.label}
              </button>
            ) : null}
            {sizerGuide ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => onView("sizer")}
                className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px] disabled:opacity-40"
              >
                <Spin on={busy === `${order.id}:view:sizer`} />
                Ver medidor
              </button>
            ) : null}
            {ringsGuide ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => onView("rings")}
                className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px] disabled:opacity-40"
              >
                <Spin on={busy === `${order.id}:view:rings`} />
                Ver guía
              </button>
            ) : null}
          </div>
        </div>
    </li>
  );
}

function OrderDrawer({
  order,
  tracking,
  setTracking,
  busy,
  hekaError,
  onClose,
  onStatus,
  onHeka,
  onView,
  onEnCamino,
}: {
  order: MoraOrder;
  tracking: string;
  setTracking: (value: string) => void;
  busy: string;
  hekaError: string;
  onClose: () => void;
  onStatus: (status: OrderStatus) => void;
  onHeka: (action: "create" | "refresh") => void;
  onView: (leg?: "sizer" | "rings") => void;
  onEnCamino: () => void;
}) {
  const phone = order.customer.phone.replace(/\D/g, "");
  const crmHref =
    order.conversationId || phone
      ? `/superadmin/crm?c=${order.conversationId || (phone.startsWith("57") ? phone : `57${phone}`)}`
      : null;
  const { steps, next } = orderJourney(order);
  const camino = enCaminoTarget(order);
  const sizerGuide = Boolean(order.shipments?.sizer?.hekaGuideId);
  const ringsGuide = Boolean(
    order.shipments?.rings?.hekaGuideId ||
      (order.shipping.hekaGuideId && order.shipping.hekaGuideId !== order.shipments?.sizer?.hekaGuideId),
  );
  const canRefreshHeka =
    (order.status === "sizer_transit" || order.status === "in_transit") &&
    Boolean(
      order.shipments?.rings?.trackingNumber ||
        order.shipments?.sizer?.trackingNumber ||
        order.shipping.trackingNumber,
    );

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

        {/* Qué sigue: una tarjeta, una acción. */}
        <section className={`order-next is-${next.tone}`}>
          <p className="order-next-kicker">
            <span className="order-next-dot" aria-hidden />
            {next.tone === "done"
              ? "Cerrado"
              : next.tone === "cancelled"
                ? "Cancelado"
                : next.waiting
                  ? "En espera de otro"
                  : "Te toca a ti"}
          </p>
          <h3 className="order-next-title">{next.title}</h3>
          <p className="order-next-body">{next.body}</p>

          {next.action === "confirm_paid" ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => onStatus("paid")}
              className="admin-cta mt-4 h-11 w-full disabled:opacity-40"
            >
              <Spin on={busy === `${order.id}:status:paid`} />
              {next.actionLabel}
            </button>
          ) : null}

          {next.action === "heka_create" ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => onHeka("create")}
              className="admin-cta mt-4 h-11 w-full disabled:opacity-40"
            >
              <Spin on={busy === `${order.id}:heka:create`} />
              {busy === `${order.id}:heka:create` ? "Creando la guía en Heka…" : next.actionLabel}
            </button>
          ) : null}

          {next.manualGuide && camino ? (
            <div className="order-manual">
              <label className="order-manual-label" htmlFor="order-guide">
                {next.action === "en_camino" ? "Número de guía" : "¿Ya tienes la guía? Escríbela y márcalo en camino"}
              </label>
              <div className="order-manual-row">
                <input
                  id="order-guide"
                  value={tracking}
                  onChange={(event) => setTracking(event.target.value)}
                  placeholder="Número de guía"
                  className="order-manual-input"
                />
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={onEnCamino}
                  className={next.action === "en_camino" ? "admin-cta order-manual-btn" : "order-manual-btn is-soft"}
                >
                  <Spin on={busy === `${order.id}:status:${camino.to}`} />
                  {camino.label}
                </button>
              </div>
            </div>
          ) : null}

          {next.action === "deliver" ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => onStatus("delivered")}
              className="admin-cta mt-4 h-11 w-full disabled:opacity-40"
            >
              <Spin on={busy === `${order.id}:status:delivered`} />
              {next.actionLabel}
            </button>
          ) : null}

          {next.action === "none" && next.waiting && crmHref ? (
            <Link href={crmHref} className="order-soft-btn mt-4">
              Recordarle por el chat
            </Link>
          ) : null}

          {hekaError ? <p className="order-error">{hekaError}</p> : null}
        </section>

        {/* Ruta del pedido: dónde va. */}
        <ol className="order-journey">
          {steps.map((step) => (
            <li key={step.id} className={`order-step is-${step.state}`}>
              <span className="order-step-dot" aria-hidden>
                {step.state === "done" ? <CheckGlyph /> : null}
              </span>
              <div className="order-step-body">
                <p className="order-step-title">
                  {step.title}
                  {step.at ? <span className="order-step-when">{formatWhen(step.at)}</span> : null}
                </p>
                {step.detail ? <p className="order-step-detail">{step.detail}</p> : null}
                {step.id === "sizer" && sizerGuide ? (
                  <button type="button" disabled={Boolean(busy)} onClick={() => onView("sizer")} className="order-step-link">
                    <Spin on={busy === `${order.id}:view:sizer`} />
                    Ver guía del medidor
                  </button>
                ) : null}
                {step.id === "rings" && ringsGuide ? (
                  <button type="button" disabled={Boolean(busy)} onClick={() => onView("rings")} className="order-step-link">
                    <Spin on={busy === `${order.id}:view:rings`} />
                    Ver guía de los anillos
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {canRefreshHeka ? (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => onHeka("refresh")}
            className="order-soft-btn mt-6"
          >
            <Spin on={busy === `${order.id}:heka:refresh`} />
            {busy === `${order.id}:heka:refresh` ? "Consultando Heka…" : "Actualizar estado en Heka"}
          </button>
        ) : null}

        {crmHref ? (
          <Link href={crmHref} className="order-soft-btn mt-3">
            Ver chat en CRM
          </Link>
        ) : null}

        {order.timeline.length > 0 ? (
          <details className="order-history">
            <summary>Historial</summary>
            <ul>
              {order.timeline.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <span>{formatWhen(event.at)}</span>
                  {ORDER_STATUS_LABEL[event.status]}
                  {event.note ? ` · ${event.note}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {order.status !== "cancelled" && order.status !== "delivered" ? (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => onStatus("cancelled")}
            className="mt-3 h-11 w-full rounded-full text-[13px] text-[var(--admin-danger)] hover:bg-red-50"
          >
            <Spin on={busy === `${order.id}:status:cancelled`} />
            Cancelar pedido
          </button>
        ) : null}
      </aside>
    </div>
  );
}
