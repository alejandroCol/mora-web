"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AbandonedCart, CartOfferKind } from "@/commerce/types";
import { commerceLineLabel } from "@/commerce/sizing";
import { finishLabel, formatMoney, products } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import { useAdminAuth } from "./AdminAuth";

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

export function AbandonedCarts() {
  const { authorizedFetch } = useAdminAuth();
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [selected, setSelected] = useState<AbandonedCart | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/carts");
    const data = (await res.json()) as { ok: boolean; carts?: AbandonedCart[] };
    if (data.ok) setCarts(data.carts ?? []);
  }, [authorizedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <section className="mt-10 rounded-[1.6rem] bg-white/[0.04] p-4">
      <div className="flex items-baseline justify-between px-2">
        <h2 className="text-[15px]">Carritos abandonados</h2>
        <span className="text-[12px] text-white/35">{carts.length}</span>
      </div>
      <p className="mt-1 px-2 text-[12px] text-white/35">
        Se guardan desde que entran al checkout. Ofrece 10%, 15% o un monto y se aplica al volver.
      </p>
      {carts.length === 0 ? (
        <p className="mt-4 px-2 text-[13px] text-white/45">Aún no hay carritos en curso.</p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {carts.map((cart) => (
          <li key={cart.id}>
            <button
              type="button"
              onClick={() => {
                setSelected(cart);
                setAmount("");
                setNote("");
              }}
              className="w-full rounded-2xl bg-white/[0.05] p-4 text-left hover:bg-white/[0.08]"
            >
              <div className="flex justify-between gap-3">
                <span className="font-medium tracking-[0.04em]">{contact(cart)}</span>
                <span className="text-[13px]">{formatMoney(cart.subtotal)}</span>
              </div>
              <p className="mt-1 text-[13px] text-white/55">
                {cart.customer.email || cart.customer.phone || "Aún sin contacto"}
                {cart.offer ? ` · ${cart.offer.code} −${formatMoney(cart.offer.discountCop)}` : ""}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-white/35">
                {cart.status === "offered" ? "Con oferta" : "Abierto"} · {ago(cart.updatedAt)}
              </p>
            </button>
          </li>
        ))}
      </ul>

      {selectedFresh ? (
        <aside
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setSelected(null)}
        >
          <div
            className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-[#14131c] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">
              {selectedFresh.status === "offered" ? "Oferta lista" : "Carrito abierto"}
            </p>
            <h2 className="mt-2 text-3xl tracking-[-0.04em]">{contact(selectedFresh)}</h2>
            <p className="mt-2 text-sm text-white/55">
              {selectedFresh.customer.email || "Sin correo"}
              <br />
              {selectedFresh.customer.phone || "Sin teléfono"}
            </p>
            {selectedFresh.shipping.ciudad ? (
              <p className="mt-3 text-sm text-white/70">
                {selectedFresh.shipping.direccion}
                <br />
                {selectedFresh.shipping.ciudad}
                {selectedFresh.shipping.departamento
                  ? ` · ${selectedFresh.shipping.departamento}`
                  : ""}
              </p>
            ) : null}

            <ul className="mt-6 space-y-2 text-sm">
              {selectedFresh.items.map((item) => {
                const model = products[item.modelId];
                return (
                  <li key={item.key} className="flex justify-between gap-3">
                    <span>
                      {commerceLineLabel({
                        ...item,
                        name: `Mora ${model?.name ?? ""}`,
                        finishTitle: finishLabel(item.modelId, item.finishId),
                      })}
                    </span>
                    <span>{formatMoney((model?.price ?? 0) * item.qty)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-right text-lg">{formatMoney(selectedFresh.subtotal)}</p>
            {selectedFresh.offer ? (
              <p className="mt-1 text-right text-[12px] text-white/40">
                {selectedFresh.offer.code} · −{formatMoney(selectedFresh.offer.discountCop)}
              </p>
            ) : null}

            <div className="mt-8 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void act(selectedFresh.id, "offer", "percent", 10)}
                className="h-11 rounded-full bg-white text-[13px] text-[#14131c] disabled:opacity-40"
              >
                10%
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act(selectedFresh.id, "offer", "percent", 15)}
                className="h-11 rounded-full bg-white text-[13px] text-[#14131c] disabled:opacity-40"
              >
                15%
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
                placeholder="Descuento en COP"
                className="h-11 flex-1 rounded-2xl bg-white/8 px-3 text-sm"
              />
              <button
                type="button"
                disabled={busy || !amount}
                onClick={() => void act(selectedFresh.id, "offer", "amount", Number(amount))}
                className="h-11 rounded-full bg-white px-4 text-[13px] text-[#14131c] disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
            {waLink(selectedFresh) ? (
              <a
                href={waLink(selectedFresh)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex h-11 items-center justify-center rounded-full text-[13px] text-white/70 hover:bg-white/8"
              >
                Escribir por WhatsApp
              </a>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(selectedFresh.id, "dismiss")}
              className="mt-2 h-11 w-full rounded-full text-[13px] text-white/40 hover:bg-white/8"
            >
              Archivar
            </button>
            {note ? (
              <p className="mt-4 break-all text-[12px] leading-5 text-white/55">{note}</p>
            ) : null}
          </div>
        </aside>
      ) : null}
    </section>
  );
}
