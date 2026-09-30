"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ACCESSORY_KIND_LABEL,
  catalog,
  emptyPurchaseOrder,
  FINANCE_CURRENCIES,
  finishes,
  formatFinanceMoney,
  purchaseTotals,
  ringCostKey,
  ringQtyKey,
  type AccessoryKind,
  type FinanceCurrency,
  type FinancePurchaseOrder,
  type PurchaseAccessory,
} from "@/commerce/finance";
import { MoneyInput } from "./moneyInput";
import type { FinanceMutator, FinanceSnapshot } from "./types";

const fieldClass =
  "h-10 w-full rounded-2xl bg-white/8 px-3 text-[13px] text-white placeholder:text-white/25";

export function PurchaseWorkbook({
  snapshot,
  mutate,
}: {
  snapshot: FinanceSnapshot;
  mutate: FinanceMutator;
}) {
  const [pickedId, setPickedId] = useState("");
  const [dirtyDraft, setDirtyDraft] = useState<FinancePurchaseOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remote =
    snapshot.orders.find((row) => row.id === pickedId) ?? snapshot.orders[0] ?? null;
  const draft = dirtyDraft && remote && dirtyDraft.id === remote.id ? dirtyDraft : remote;
  const dirty = Boolean(dirtyDraft && remote && dirtyDraft.id === remote.id);
  const totals = useMemo(() => (draft ? purchaseTotals(draft) : null), [draft]);
  const decimals = draft && draft.currency !== "COP" ? 2 : 0;

  function edit(next: Partial<FinancePurchaseOrder>) {
    if (!draft) return;
    setDirtyDraft({ ...draft, ...next });
  }

  function setQty(key: string, qty: number) {
    if (!draft) return;
    edit({ ringQty: { ...draft.ringQty, [key]: qty } });
  }

  function setCost(key: string, unitCost: number) {
    if (!draft) return;
    edit({ ringCost: { ...draft.ringCost, [key]: unitCost } });
  }

  function setExtra(id: string, patch: Partial<PurchaseAccessory>) {
    if (!draft) return;
    edit({
      extras: draft.extras.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await mutate(`/api/admin/finance/orders/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: draft.title,
          supplier: draft.supplier,
          orderedAt: draft.orderedAt,
          notes: draft.notes,
          currency: draft.currency,
          fxRateToCop: draft.fxRateToCop,
          ringQty: draft.ringQty,
          ringCost: draft.ringCost,
          extras: draft.extras,
        }),
      });
      setDirtyDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function createOrder() {
    setBusy(true);
    setError("");
    try {
      const created = await mutate("/api/admin/finance/orders", {
        method: "POST",
        body: JSON.stringify(emptyPurchaseOrder({ title: snapshot.orders.length ? "Nuevo pedido" : "Primer pedido" })),
      });
      const newest = created.orders.reduce<(typeof created.orders)[number] | null>(
        (lead, row) => (!lead || row.createdAt > lead.createdAt ? row : lead),
        null,
      );
      if (newest) {
        setPickedId(newest.id);
        setDirtyDraft(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setBusy(false);
    }
  }

  if (!draft || !totals) {
    return (
      <div className="frame-in rounded-[1.6rem] bg-white/[0.04] px-6 py-12 text-center">
        <p className="font-display text-3xl tracking-[-0.05em]">El primer pedido.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/45">
          Aero y Titan, color por talla, forros y cargadores aparte. Escribes cantidades y costos; el
          total se arma solo.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createOrder()}
          className="mt-8 h-11 rounded-full bg-white px-6 text-[13px] text-[#0e0d14]"
        >
          Abrir hoja
        </button>
      </div>
    );
  }

  return (
    <div className="frame-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl tracking-[-0.05em]">La hoja del pedido.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
            Cuántos quieres de cada color y talla, cuánto cuesta cada uno, y aparte forros y
            cargadores. Guarda cuando termines.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {snapshot.orders.length > 1 ? (
            <select
              value={draft.id}
              onChange={(event) => {
                setPickedId(event.target.value);
                setDirtyDraft(null);
              }}
              className="h-10 rounded-full bg-white/8 px-3 text-[13px]"
            >
              {snapshot.orders.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void createOrder()}
            className="h-10 rounded-full bg-white/8 px-4 text-[12px] text-white/70"
          >
            Otro pedido
          </button>
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => void save()}
            className="h-10 rounded-full bg-white px-5 text-[13px] text-[#0e0d14] disabled:opacity-40"
          >
            {busy ? "Guardando…" : dirty ? "Guardar" : "Guardado"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Nombre">
          <input
            value={draft.title}
            onChange={(event) => edit({ title: event.target.value })}
            className={fieldClass}
          />
        </Field>
        <Field label="Proveedor">
          <input
            value={draft.supplier}
            placeholder="Fábrica, trading…"
            onChange={(event) => edit({ supplier: event.target.value })}
            className={fieldClass}
          />
        </Field>
        <Field label="Fecha">
          <input
            type="date"
            value={draft.orderedAt}
            onChange={(event) => edit({ orderedAt: event.target.value })}
            className={fieldClass}
          />
        </Field>
        <Field label="Moneda">
          <div className="flex gap-2">
            <select
              value={draft.currency}
              onChange={(event) => edit({ currency: event.target.value as FinanceCurrency })}
              className={`${fieldClass} flex-1`}
            >
              {FINANCE_CURRENCIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {draft.currency !== "COP" ? (
              <input
                inputMode="decimal"
                value={draft.fxRateToCop || ""}
                placeholder="TRM"
                onChange={(event) =>
                  edit({ fxRateToCop: Number(event.target.value.replace(",", ".")) || 0 })
                }
                className={`${fieldClass} w-24`}
              />
            ) : null}
          </div>
        </Field>
      </section>

      <div className="mt-8 space-y-8">
        {catalog.map((product) => (
          <section key={product.id} className="rounded-[1.6rem] bg-white/[0.04] p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-xl tracking-[-0.03em]">{product.name}</h3>
              <p className="text-[12px] text-white/35">{product.line}</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-[13px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    <th className="pb-1 text-left font-normal">Color</th>
                    {product.sizes.map((size) => (
                      <th key={size} className="pb-1 font-normal">
                        T{size}
                      </th>
                    ))}
                    <th className="pb-1 text-right font-normal">Costo c/u</th>
                  </tr>
                </thead>
                <tbody>
                  {product.finishes.map((finishId) => {
                    const finish = finishes[finishId];
                    const costKey = ringCostKey(product.id, finishId);
                    return (
                      <tr key={finishId}>
                        <td className="pr-3">
                          <span className="flex items-center gap-2">
                            <span className="jewel" style={{ background: finish.swatch }} />
                            {finish.title}
                          </span>
                        </td>
                        {product.sizes.map((size) => {
                          const key = ringQtyKey(product.id, finishId, size);
                          return (
                            <td key={size} className="px-0.5">
                              <MoneyInput
                                value={draft.ringQty[key] ?? 0}
                                ariaLabel={`${product.name} ${finish.title} talla ${size}`}
                                onCommit={(qty) => setQty(key, Math.round(qty))}
                                className="h-10 w-14 rounded-xl bg-white/8 text-center text-[13px]"
                              />
                            </td>
                          );
                        })}
                        <td className="pl-2">
                          <MoneyInput
                            value={draft.ringCost[costKey] ?? 0}
                            decimals={decimals}
                            ariaLabel={`Costo ${product.name} ${finish.title}`}
                            onCommit={(unitCost) => setCost(costKey, unitCost)}
                            className="h-10 w-24 rounded-xl bg-white/8 px-2 text-right text-[13px]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-6 grid gap-3 lg:grid-cols-2">
        {(["cover", "charger"] as AccessoryKind[]).map((kind) => {
          const rows = draft.extras.filter((row) => row.kind === kind);
          return (
            <article key={kind} className="rounded-[1.6rem] bg-white/[0.04] p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px]">{ACCESSORY_KIND_LABEL[kind]}</h3>
                <button
                  type="button"
                  onClick={() =>
                    edit({
                      extras: [
                        ...draft.extras,
                        {
                          id: crypto.randomUUID(),
                          kind,
                          label: ACCESSORY_KIND_LABEL[kind],
                          qty: 0,
                          unitCost: 0,
                        },
                      ],
                    })
                  }
                  className="text-[12px] text-white/45 hover:text-white"
                >
                  Otra línea
                </button>
              </div>
              <ul className="mt-4 space-y-3">
                {rows.map((row) => (
                  <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_2rem] items-center gap-2">
                    <input
                      value={row.label}
                      onChange={(event) => setExtra(row.id, { label: event.target.value })}
                      className={fieldClass}
                    />
                    <MoneyInput
                      value={row.qty}
                      ariaLabel={`Cantidad ${row.label}`}
                      onCommit={(qty) => setExtra(row.id, { qty: Math.round(qty) })}
                      className="h-10 rounded-2xl bg-white/8 text-center text-[13px]"
                    />
                    <MoneyInput
                      value={row.unitCost}
                      decimals={decimals}
                      ariaLabel={`Costo ${row.label}`}
                      onCommit={(unitCost) => setExtra(row.id, { unitCost })}
                      className="h-10 rounded-2xl bg-white/8 px-2 text-right text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        edit({ extras: draft.extras.filter((item) => item.id !== row.id) })
                      }
                      className="text-white/30 hover:text-white"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      <section className="mt-6 rounded-[1.6rem] bg-white px-5 py-6 text-[#0e0d14]">
        <div className="grid gap-4 sm:grid-cols-3">
          <Summary
            label="Anillos"
            value={`${totals.ringQty} · ${formatFinanceMoney(totals.ringCost, draft.currency)}`}
          />
          <Summary
            label="Forros"
            value={`${totals.coverQty} · ${formatFinanceMoney(totals.coverCost, draft.currency)}`}
          />
          <Summary
            label="Cargadores"
            value={`${totals.chargerQty} · ${formatFinanceMoney(totals.chargerCost, draft.currency)}`}
          />
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#0e0d14]/45">Total del pedido</p>
            <p className="mt-1 font-display text-4xl tracking-[-0.05em]">
              {formatFinanceMoney(totals.total, draft.currency)}
            </p>
            {draft.currency !== "COP" ? (
              <p className="mt-1 text-sm text-[#0e0d14]/50">
                {formatFinanceMoney(totals.totalCop)} con TRM {draft.fxRateToCop || "—"}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {draft.recordedExpenseIds.length ? (
              <p className="self-center text-[12px] text-[#0e0d14]/45">Ya está en el libro de gastos.</p>
            ) : (
              <button
                type="button"
                disabled={busy || dirty || totals.total <= 0}
                onClick={() =>
                  void mutate(`/api/admin/finance/orders/${draft.id}/record`, { method: "POST" })
                }
                className="h-10 rounded-full bg-[#0e0d14] px-4 text-[12px] text-white disabled:opacity-40"
              >
                Pasar a gastos
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (window.confirm("¿Borrar esta hoja?")) {
                  void mutate(`/api/admin/finance/orders/${draft.id}`, { method: "DELETE" }).then(
                    () => {
                      setPickedId("");
                      setDirtyDraft(null);
                    },
                  );
                }
              }}
              className="h-10 rounded-full px-4 text-[12px] text-[#0e0d14]/40"
            >
              Borrar hoja
            </button>
          </div>
        </div>
        <textarea
          value={draft.notes}
          onChange={(event) => edit({ notes: event.target.value })}
          placeholder="Notas del pedido: depositos, lead time, packing…"
          className="mt-5 min-h-20 w-full rounded-2xl bg-[#0e0d14]/6 px-3 py-2 text-[13px] text-[#0e0d14] placeholder:text-[#0e0d14]/35"
        />
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-[0.12em] text-white/35">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#0e0d14]/40">{label}</p>
      <p className="mt-1 text-[15px]">{value}</p>
    </div>
  );
}
