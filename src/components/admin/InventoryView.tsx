"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  DEFAULT_PRICING,
  factoryPrice,
  normalizePricing,
  parsePriceCop,
  PRICING_KEYS,
  PRICING_LABEL,
  type Pricing,
  type PricingKey,
} from "@/commerce/pricing";
import { availableUnits, caseSku, inventorySku } from "@/commerce/sku";
import type { InventoryDoc } from "@/commerce/types";
import { CASE_COLOR_LIST } from "@/lib/cases";
import { catalog, formatMoney, productTitle, resolveFinish } from "@/lib/catalog";
import { useAdminAuth } from "./AdminAuth";

type PricingResponse = { ok?: boolean; error?: string; pricing?: Record<string, unknown> };
type InventoryResponse = { ok?: boolean; error?: string; inventory?: InventoryDoc[] };

function ago(at: number) {
  if (!at) return "";
  const diff = Math.max(0, Date.now() - at);
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

function groupDigits(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function InventoryView() {
  const { authorizedFetch } = useAdminAuth();
  const [rows, setRows] = useState<InventoryDoc[]>([]);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const loadInventory = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/inventory");
    const data = (await res.json()) as InventoryResponse;
    if (!res.ok || data.ok === false) {
      setError(data.error || "No se pudo leer el inventario.");
      return;
    }
    setRows(data.inventory ?? []);
  }, [authorizedFetch]);

  const loadPricing = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/pricing");
    const data = (await res.json()) as PricingResponse;
    if (!res.ok || data.ok === false) {
      setError(data.error || "No se pudieron leer los precios.");
      setPricing(DEFAULT_PRICING);
      return;
    }
    setPricing(normalizePricing(data.pricing));
  }, [authorizedFetch]);

  useEffect(() => {
    void loadInventory();
    void loadPricing();
  }, [loadInventory, loadPricing]);

  const bySku = useMemo(() => new Map(rows.map((row) => [row.sku, row])), [rows]);

  async function saveUnits(sku: string, units: number) {
    setSaving(sku);
    setError("");
    const res = await authorizedFetch("/api/admin/inventory", {
      method: "PUT",
      body: JSON.stringify({ sku, units }),
    });
    const data = (await res.json()) as InventoryResponse;
    if (!res.ok || data.ok === false) {
      setError(data.error || "No se pudo guardar.");
      setSaving(null);
      return;
    }
    if (data.inventory) setRows(data.inventory);
    else await loadInventory();
    setSaving(null);
  }

  async function savePrice(key: PricingKey, value: number) {
    setSaving(`price:${key}`);
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/pricing", {
        method: "PUT",
        body: JSON.stringify({ [key]: value }),
      });
      const data = (await res.json()) as PricingResponse;
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo guardar.");
      setPricing(normalizePricing(data.pricing));
      flash(`${PRICING_LABEL[key].name} ahora vale ${formatMoney(value)}.`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      return false;
    } finally {
      setSaving(null);
    }
  }

  function totalsFor(skus: string[]) {
    let units = 0;
    let reserved = 0;
    for (const sku of skus) {
      const row = bySku.get(sku);
      units += row?.units ?? 0;
      reserved += row?.reserved ?? 0;
    }
    return { units, reserved, available: availableUnits(units, reserved) };
  }

  return (
    <div className="ventas-app">
      <header>
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Operación</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">Inventario y precios.</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
          El precio de venta de cada producto y las unidades por talla y color. Los precios
          salen a la tienda al instante; el stock empieza en 50 y se descuenta al pagar.
        </p>
      </header>

      {error ? <p className="text-[13px] text-[var(--admin-danger)]">{error}</p> : null}

      <section>
        <SectionTitle title="Precios" hint="Lo que paga el cliente por unidad, antes de envío y descuentos." />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {PRICING_KEYS.map((key) => (
            <PriceCard
              key={key}
              pricingKey={key}
              value={pricing ? pricing[key] : null}
              updatedAt={pricing?.updatedAt ?? 0}
              busy={saving === `price:${key}`}
              onSave={(value) => savePrice(key, value)}
            />
          ))}
        </div>
      </section>

      {catalog.map((product) => {
        const skus = product.finishes.flatMap((finishId) =>
          product.sizes.map((size) => inventorySku(product.id, finishId, size)),
        );
        const totals = totalsFor(skus);
        return (
          <section key={product.id} className="admin-sheet">
            <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4 sm:px-5">
              <div>
                <p className="text-[15px] font-medium">{productTitle(product.id)}</p>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {product.line} · {pricing ? formatMoney(pricing[product.id]) : "…"} · tallas{" "}
                  {product.sizes[0]} a {product.sizes[product.sizes.length - 1]}
                </p>
              </div>
              <StockPill {...totals} />
            </div>
            <div className="mt-3 overflow-x-auto px-2 pb-3 sm:px-3">
              <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-[13px]">
                <thead>
                  <tr className="text-[11px] text-[var(--admin-muted)]">
                    <th className="pb-1 pl-2 text-left font-normal">Color</th>
                    {product.sizes.map((size) => (
                      <th key={size} className="pb-1 font-normal">
                        T{size}
                      </th>
                    ))}
                    <th className="pb-1 pr-2 text-right font-normal">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {product.finishes.map((finishId) => {
                    const finish = resolveFinish(product.id, finishId);
                    const rowSkus = product.sizes.map((size) =>
                      inventorySku(product.id, finishId, size),
                    );
                    const rowTotals = totalsFor(rowSkus);
                    return (
                      <tr key={finishId}>
                        <td className="pl-2 pr-3">
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <span className="jewel" style={{ background: finish.swatch }} />
                            {finish.title}
                          </span>
                        </td>
                        {product.sizes.map((size) => {
                          const sku = inventorySku(product.id, finishId, size);
                          const row = bySku.get(sku);
                          return (
                            <td key={size} className="px-0.5 align-top">
                              <UnitsCell
                                sku={sku}
                                units={row?.units ?? 0}
                                reserved={row?.reserved ?? 0}
                                busy={saving === sku}
                                label={`${productTitle(product.id)} ${finish.title} talla ${size}`}
                                onSave={saveUnits}
                              />
                            </td>
                          );
                        })}
                        <td className="pr-2 text-right text-[var(--admin-muted)]">
                          {rowTotals.available}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="admin-sheet">
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4 sm:px-5">
          <div>
            <p className="text-[15px] font-medium">Mora Case</p>
            <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
              {PRICING_LABEL.case.line} · {pricing ? formatMoney(pricing.case) : "…"} · talla única,
              para Pro y Ultra
            </p>
          </div>
          <StockPill {...totalsFor(CASE_COLOR_LIST.map((color) => caseSku(color.id)))} />
        </div>
        <ul className="mt-3 grid gap-2 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-5 sm:px-4">
          {CASE_COLOR_LIST.map((color) => {
            const sku = caseSku(color.id);
            const row = bySku.get(sku);
            const units = row?.units ?? 0;
            const reserved = row?.reserved ?? 0;
            return (
              <li
                key={color.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--admin-field)] px-3 py-2.5 lg:flex-col lg:items-start"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="h-9 w-9 shrink-0 rounded-xl bg-cover bg-center shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                    style={{ backgroundImage: `url(${color.src})` }}
                    aria-hidden
                  />
                  <span className="flex flex-col leading-tight">
                    <span className="text-[13px]">{color.title}</span>
                    <span className="text-[11px] text-[var(--admin-muted)]">
                      {availableUnits(units, reserved)} disponibles
                    </span>
                  </span>
                </span>
                <UnitsCell
                  sku={sku}
                  units={units}
                  reserved={reserved}
                  busy={saving === sku}
                  label={`Mora Case ${color.title}`}
                  onSave={saveUnits}
                  wide
                />
              </li>
            );
          })}
        </ul>
      </section>

      {toast ? (
        <p className="pointer-events-none fixed bottom-[calc(var(--admin-dock)+1rem)] left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1d1d1f] px-4 py-2 text-[12px] text-white shadow-lg lg:bottom-6">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <p className="text-[15px] font-medium">{title}</p>
      <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{hint}</p>
    </div>
  );
}

function StockPill({ available, reserved }: { available: number; reserved: number }) {
  return (
    <p className="rounded-full bg-[var(--admin-field)] px-3 py-1 text-[12px] text-[var(--admin-muted)]">
      <span className="text-[var(--admin-ink)]">{available}</span> disponibles
      {reserved > 0 ? ` · ${reserved} en checkout` : ""}
    </p>
  );
}

function UnitsCell({
  sku,
  units,
  reserved,
  busy,
  label,
  onSave,
  wide = false,
}: {
  sku: string;
  units: number;
  reserved: number;
  busy: boolean;
  label: string;
  onSave: (sku: string, units: number) => Promise<void>;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "flex items-center gap-2" : ""}>
      <input
        type="number"
        min={0}
        defaultValue={units}
        key={`${sku}-${units}`}
        aria-label={label}
        title={reserved > 0 ? `${reserved} en checkout` : undefined}
        onBlur={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next) && next !== units) void onSave(sku, next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        className={`h-10 rounded-xl bg-white text-center text-[13px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] outline-none focus:shadow-[inset_0_0_0_2px_#1d1d1f] ${
          wide ? "w-20" : "w-14"
        }`}
      />
      {reserved > 0 && !wide ? (
        <p className="mt-1 text-center text-[10px] text-[var(--admin-muted)]">{reserved} en checkout</p>
      ) : null}
      {busy ? <p className="mt-1 text-center text-[10px] text-[var(--admin-muted)]">…</p> : null}
    </div>
  );
}

function PriceCard({
  pricingKey,
  value,
  updatedAt,
  busy,
  onSave,
}: {
  pricingKey: PricingKey;
  value: number | null;
  updatedAt: number;
  busy: boolean;
  onSave: (value: number) => Promise<boolean>;
}) {
  const label = PRICING_LABEL[pricingKey];
  // null = sin edición: se muestra el precio guardado. string = lo que teclea el admin.
  const [draft, setDraft] = useState<string | null>(null);

  const shown = draft ?? (value == null ? "" : groupDigits(String(value)));
  const parsed = parsePriceCop(shown);
  const dirty = draft != null && value != null && parsed !== value;
  const factory = factoryPrice(pricingKey);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!dirty || parsed == null) return;
    const ok = await onSave(parsed);
    if (ok) setDraft(null);
  }

  return (
    <form onSubmit={submit} className="ventas-kpi flex flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium">{label.name}</p>
        <p className="text-[11px] text-[var(--admin-muted)]">{label.line}</p>
      </div>
      <label className="mt-3 flex items-center gap-1.5 rounded-xl bg-[var(--admin-field)] px-3">
        <span className="text-[17px] text-[var(--admin-muted)]">$</span>
        <input
          value={shown}
          placeholder={value == null ? "…" : undefined}
          disabled={value == null || busy}
          inputMode="numeric"
          aria-label={`Precio ${label.name}`}
          onBlur={() => {
            if (!dirty) setDraft(null);
          }}
          onChange={(event) => setDraft(groupDigits(event.target.value))}
          className="h-11 w-full bg-transparent text-[20px] font-semibold tracking-[-0.03em] outline-none"
        />
        <span className="text-[11px] text-[var(--admin-muted)]">COP</span>
      </label>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] text-[var(--admin-muted)]">
          {dirty
            ? parsed != null
              ? `Pasa a ${formatMoney(parsed)}`
              : "Precio fuera de rango"
            : value != null && value !== factory
              ? `De fábrica ${formatMoney(factory)}${updatedAt ? ` · ${ago(updatedAt)}` : ""}`
              : updatedAt
                ? `Actualizado ${ago(updatedAt)}`
                : "Precio de fábrica"}
        </p>
        {dirty ? (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="h-8 rounded-full px-3 text-[12px] text-[var(--admin-muted)]"
            >
              Deshacer
            </button>
            <button
              type="submit"
              disabled={busy || parsed == null}
              className="admin-cta h-8 w-auto px-4 text-[12px] disabled:opacity-40"
            >
              {busy ? "…" : "Guardar"}
            </button>
          </div>
        ) : null}
      </div>
    </form>
  );
}
