"use client";

import { useMemo, useState } from "react";
import { cartLineKey } from "@/commerce/sku";
import type { CartLine, PaymentMethod } from "@/commerce/types";
import { catalog, finishes, formatMoney, products, type FinishId, type ModelId } from "@/lib/catalog";
import { ColombiaFields } from "@/components/checkout/ColombiaFields";
import { PAYMENT_METHOD_LABEL } from "@/commerce/labels";

const MANUAL_METHODS: Exclude<PaymentMethod, "wompi">[] = [
  "transferencia",
  "efectivo",
  "datafono",
];

export function ManualSaleForm({
  onClose,
  onCreated,
  authorizedFetch,
  initial,
}: {
  onClose: () => void;
  onCreated: () => void;
  authorizedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  initial?: {
    firstName?: string;
    phone?: string;
    email?: string;
    notes?: string;
    conversationId?: string;
    channel?: "manual" | "whatsapp";
  };
}) {
  const [modelId, setModelId] = useState<ModelId>("aero");
  const [finishId, setFinishId] = useState<FinishId>(products.aero.finishes[0]);
  const [size, setSize] = useState(8);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [departamento, setDepartamento] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [direccion, setDireccion] = useState("");
  const [pickup, setPickup] = useState(true);
  const [method, setMethod] = useState<Exclude<PaymentMethod, "wompi">>("efectivo");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const model = products[modelId];
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + products[line.modelId].price * line.qty, 0),
    [lines],
  );

  function addLine() {
    const key = cartLineKey(modelId, finishId, size);
    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [...current, { key, modelId, finishId, size, qty: 1 }];
    });
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/orders", {
        method: "POST",
        body: JSON.stringify({
          items: lines,
          paymentMethod: method,
          notes,
          channel: initial?.channel ?? "manual",
          conversationId: initial?.conversationId,
          customer: {
            firstName: firstName || "Cliente",
            lastName: "",
            email,
            phone,
          },
          shipping: pickup
            ? {
                departamento: "",
                ciudad: "Atelier",
                direccion: "Venta en punto",
                envioCop: 0,
                fuente: "estatico",
              }
            : {
                departamento,
                ciudad,
                direccion,
                envioCop: 0,
                fuente: "estatico",
              },
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-6">
      <div className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[#16141f] p-6 text-[#f4f1ea] sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Nueva venta</p>
            <h2 className="mt-1 text-2xl tracking-[-0.04em]">Registrar a mano</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-white/50">
            Cerrar
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <select
            value={modelId}
            onChange={(event) => {
              const next = event.target.value as ModelId;
              setModelId(next);
              setFinishId(products[next].finishes[0]);
            }}
            className="h-11 rounded-2xl bg-white/8 px-3 text-sm"
          >
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            {model.finishes.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFinishId(id)}
                className={`jewel ${finishId === id ? "jewel-on" : ""}`}
                style={{ background: finishes[id].swatch }}
                aria-label={finishes[id].title}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {model.sizes.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSize(item)}
                className={`h-8 min-w-8 rounded-full px-2 text-[12px] ${
                  size === item ? "bg-white text-[#16141f]" : "text-white/50"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-4 h-10 rounded-full bg-white px-5 text-[13px] text-[#16141f]"
        >
          Añadir anillo
        </button>

        <ul className="mt-4 divide-y divide-white/8 text-sm">
          {lines.map((line) => (
            <li key={line.key} className="flex justify-between py-2">
              <span>
                {products[line.modelId].name} · {finishes[line.finishId].title} · #{line.size} ×
                {line.qty}
              </span>
              <button
                type="button"
                className="text-white/40"
                onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Nombre"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="h-11 rounded-2xl bg-white/8 px-3 text-sm"
          />
          <input
            placeholder="Teléfono"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="h-11 rounded-2xl bg-white/8 px-3 text-sm"
          />
          <input
            placeholder="Correo (opcional)"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 rounded-2xl bg-white/8 px-3 text-sm sm:col-span-2"
          />
        </div>

        <label className="mt-5 flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={pickup}
            onChange={(event) => setPickup(event.target.checked)}
          />
          Entrega en el atelier / sin envío
        </label>

        {!pickup ? (
          <div className="mt-4 overflow-hidden rounded-2xl bg-white text-[#16141f]">
            <ColombiaFields
              departamento={departamento}
              ciudad={ciudad}
              onDepartamento={(value) => {
                setDepartamento(value);
                setCiudad("");
              }}
              onCiudad={setCiudad}
            />
            <label className="reserve-row">
              <span>Dirección</span>
              <input
                value={direccion}
                onChange={(event) => setDireccion(event.target.value)}
                className="reserve-input"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {MANUAL_METHODS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMethod(item)}
              className={`rounded-full px-4 py-2 text-[13px] ${
                method === item ? "bg-white text-[#16141f]" : "bg-white/8 text-white/70"
              }`}
            >
              {PAYMENT_METHOD_LABEL[item]}
            </button>
          ))}
        </div>

        <textarea
          placeholder="Nota interna"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className="mt-4 w-full rounded-2xl bg-white/8 p-3 text-sm"
        />

        <div className="mt-6 flex items-center justify-between">
          <p className="text-lg">{formatMoney(subtotal)}</p>
          <button
            type="button"
            disabled={busy || lines.length === 0}
            onClick={() => void submit()}
            className="h-11 rounded-full bg-white px-6 text-[13px] text-[#16141f] disabled:opacity-40"
          >
            {busy ? "Guardando…" : "Registrar venta"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}
