"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AbandonedCart, CartOfferKind } from "@/commerce/types";
import { lineUnitPrice } from "@/commerce/lines";
import { commerceLineLabel } from "@/commerce/sizing";
import { formatMoney } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import { useAdminAuth } from "./AdminAuth";

type Filter = "all" | "open" | "offered";

function ago(at: number) {
  const diff = Math.max(0, Date.now() - at);
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

function contact(cart: AbandonedCart) {
  const name = `${cart.customer.firstName ?? ""} ${cart.customer.lastName ?? ""}`.trim();
  return name || cart.customer.email || cart.customer.phone || "Sin datos aún";
}

function waLink(cart: AbandonedCart) {
  const phone = (cart.customer.phone ?? "").replace(/\D/g, "");
  if (phone.length < 10) return "";
  const local = phone.startsWith("57") ? phone : `57${phone}`;
  const code = cart.offer?.code;
  const text = code
    ? `Hola${cart.customer.firstName ? ` ${cart.customer.firstName}` : ""}, dejamos tu Mora con descuento. Código ${code}. Puedes terminar aquí: ${siteUrl(`/checkout?oferta=${code}`)}`
    : `Hola${cart.customer.firstName ? ` ${cart.customer.firstName}` : ""}, vi que dejaste tu Mora en el checkout. ¿Te ayudo a terminarlo?`;
  return `https://wa.me/${local}?text=${encodeURIComponent(text)}`;
}

export function AbandonedCartsModule() {
  const { authorizedFetch } = useAdminAuth();
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [selected, setSelected] = useState<AbandonedCart | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/carts");
    const data = (await res.json()) as { ok: boolean; carts?: AbandonedCart[] };
    if (data.ok) setCarts(data.carts ?? []);
  }, [authorizedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const open = carts.filter((c) => c.status === "open").length;
    const offered = carts.filter((c) => c.status === "offered").length;
    const value = carts.reduce((sum, c) => sum + c.subtotal, 0);
    return { open, offered, value, total: carts.length };
  }, [carts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return carts.filter((cart) => {
      if (filter === "open" && cart.status !== "open") return false;
      if (filter === "offered" && cart.status !== "offered") return false;
      if (!q) return true;
      return (
        contact(cart).toLowerCase().includes(q) ||
        (cart.customer.email ?? "").toLowerCase().includes(q) ||
        (cart.customer.phone ?? "").includes(q)
      );
    });
  }, [carts, filter, query]);

  const selectedFresh = useMemo(
    () => carts.find((cart) => cart.id === selected?.id) ?? selected,
    [carts, selected],
  );

  async function act(id: string, action: "offer" | "dismiss", kind?: CartOfferKind, value?: number) {
    setBusy(true);
    setNote("");
    try {
      const res = await authorizedFetch(`/api/admin/carts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, kind, value }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        cart?: AbandonedCart;
        emailed?: boolean;
        checkoutUrl?: string;
      };
      if (!data.ok) throw new Error(data.error);
      if (data.cart) setSelected(data.cart);
      if (action === "offer") {
        const sent = data.emailed ? "Correo enviado." : "Oferta lista. Copia el enlace si no hay correo.";
        setNote(data.checkoutUrl ? `${sent} ${data.checkoutUrl}` : sent);
      }
      await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "No se pudo aplicar.");
    } finally {
      setBusy(false);
    }
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "open", label: "Sin oferta" },
    { id: "offered", label: "Con oferta" },
  ];

  return (
    <div className="ventas-app">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Recuperación</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.05em] text-[#f4f1ea]">
            Carritos abandonados.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
            Personas que entraron al checkout y no pagaron. Ofrece descuento o escribe por WhatsApp.
          </p>
        </div>
        <Link
          href="/superadmin/ventas"
          className="h-10 rounded-full bg-white/8 px-4 text-[12px] leading-10 text-white/55"
        >
          Ir a ventas
        </Link>
      </header>

      <div className="ventas-kpis">
        <Kpi label="Activos" value={String(stats.total)} hint="En seguimiento" />
        <Kpi label="Sin oferta" value={String(stats.open)} hint="Listos para contactar" />
        <Kpi label="Con oferta" value={String(stats.offered)} hint="Esperando respuesta" />
        <Kpi label="Valor en carrito" value={formatMoney(stats.value)} hint="Subtotal acumulado" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-3 py-1.5 text-[12px] ${
              filter === item.id ? "bg-[#1d1d1f] text-white" : "bg-white/8 text-white/55"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar nombre, correo o teléfono"
        className="h-11 w-full max-w-md rounded-full bg-white/8 px-4 text-[13px] outline-none"
      />

      {filtered.length === 0 ? (
        <p className="rounded-[1.25rem] bg-white px-5 py-8 text-[14px] text-[var(--admin-muted)] shadow-[var(--admin-shadow)]">
          {carts.length === 0
            ? "Aún no hay carritos. Aparecen cuando alguien entra al checkout."
            : "Nada en este filtro."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((cart) => (
            <li key={cart.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(cart);
                  setAmount("");
                  setNote("");
                }}
                className="ventas-row w-full text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-medium">{contact(cart)}</p>
                    <p className="mt-1 text-[13px] text-[var(--admin-muted)]">
                      {cart.customer.email || cart.customer.phone || "Aún sin contacto"}
                    </p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                      {cart.status === "offered" ? "Con oferta" : "Abierto"} · {ago(cart.updatedAt)}
                      {cart.items.length ? ` · ${cart.items.length} anillo(s)` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px]">{formatMoney(cart.subtotal)}</p>
                    {cart.offer ? (
                      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                        {cart.offer.code} −{formatMoney(cart.offer.discountCop)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedFresh ? (
        <CartDrawer
          cart={selectedFresh}
          amount={amount}
          setAmount={setAmount}
          busy={busy}
          note={note}
          onClose={() => setSelected(null)}
          onAct={act}
        />
      ) : null}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="ventas-kpi">
      <p className="text-[11px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">{hint}</p>
    </div>
  );
}

function CartDrawer({
  cart,
  amount,
  setAmount,
  busy,
  note,
  onClose,
  onAct,
}: {
  cart: AbandonedCart;
  amount: string;
  setAmount: (value: string) => void;
  busy: boolean;
  note: string;
  onClose: () => void;
  onAct: (id: string, action: "offer" | "dismiss", kind?: CartOfferKind, value?: number) => void;
}) {
  const phone = (cart.customer.phone ?? "").replace(/\D/g, "");
  const crmHref = phone ? `/superadmin/crm?c=${phone.startsWith("57") ? phone : `57${phone}`}` : null;

  return (
    <div className="admin-drawer-backdrop" onClick={onClose}>
      <aside className="admin-drawer" onClick={(event) => event.stopPropagation()}>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--admin-muted)]">
          {cart.status === "offered" ? "Oferta enviada" : "Recuperar venta"}
        </p>
        <h2 className="mt-2 font-display text-3xl tracking-[-0.04em]">{contact(cart)}</h2>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">
          {cart.customer.email || "Sin correo"}
          <br />
          {cart.customer.phone || "Sin teléfono"}
        </p>
        {cart.shipping.ciudad ? (
          <p className="mt-3 text-sm">
            {cart.shipping.direccion}
            <br />
            {cart.shipping.ciudad}
            {cart.shipping.departamento ? ` · ${cart.shipping.departamento}` : ""}
          </p>
        ) : null}

        <ul className="mt-6 space-y-2 text-sm">
          {cart.items.map((item) => {
            return (
              <li key={item.key} className="flex justify-between gap-3">
                <span>{commerceLineLabel(item)}</span>
                <span>{formatMoney(lineUnitPrice(item) * item.qty)}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-right text-lg font-medium">{formatMoney(cart.subtotal)}</p>
        {cart.offer ? (
          <p className="mt-1 text-right text-[12px] text-[var(--admin-muted)]">
            {cart.offer.code} · −{formatMoney(cart.offer.discountCop)}
          </p>
        ) : null}

        <p className="mt-6 text-[13px] leading-6 text-[var(--admin-muted)]">
          El descuento se aplica si vuelven con el código. Puedes copiar el enlace del checkout tras
          crear la oferta.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAct(cart.id, "offer", "percent", 10)}
            className="admin-cta h-11 disabled:opacity-40"
          >
            Oferta 10%
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAct(cart.id, "offer", "percent", 15)}
            className="admin-cta h-11 disabled:opacity-40"
          >
            Oferta 15%
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
            placeholder="Descuento en COP"
            className="h-11 flex-1 rounded-2xl bg-[var(--admin-field)] px-3 text-sm outline-none"
          />
          <button
            type="button"
            disabled={busy || !amount}
            onClick={() => void onAct(cart.id, "offer", "amount", Number(amount))}
            className="admin-cta h-11 shrink-0 px-4 disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
        {waLink(cart) ? (
          <a
            href={waLink(cart)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex h-11 items-center justify-center rounded-full border border-[var(--admin-line)] text-[13px]"
          >
            WhatsApp
          </a>
        ) : null}
        {crmHref ? (
          <Link
            href={crmHref}
            className="mt-2 flex h-11 items-center justify-center rounded-full bg-[var(--admin-field)] text-[13px]"
          >
            Abrir en CRM
          </Link>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAct(cart.id, "dismiss")}
          className="mt-2 h-11 w-full rounded-full text-[13px] text-[var(--admin-danger)] hover:bg-red-50"
        >
          Archivar
        </button>
        {note ? <p className="mt-4 break-all text-[12px] leading-5 text-[var(--admin-muted)]">{note}</p> : null}
      </aside>
    </div>
  );
}
