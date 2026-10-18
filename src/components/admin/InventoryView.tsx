"use client";

import { useCallback, useEffect, useState } from "react";
import { inventorySku } from "@/commerce/sku";
import type { InventoryDoc } from "@/commerce/types";
import { catalog, finishes, productTitle } from "@/lib/catalog";
import { useAdminAuth } from "./AdminAuth";

export function InventoryView() {
  const { authorizedFetch } = useAdminAuth();
  const [rows, setRows] = useState<InventoryDoc[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/inventory");
    const data = (await res.json()) as { inventory?: InventoryDoc[] };
    setRows(data.inventory ?? []);
  }, [authorizedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(sku: string, units: number) {
    setSaving(sku);
    setError("");
    const res = await authorizedFetch("/api/admin/inventory", {
      method: "PUT",
      body: JSON.stringify({ sku, units }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; inventory?: InventoryDoc[] };
    if (!res.ok || data.ok === false) {
      setError(data.error || "No se pudo guardar.");
      setSaving(null);
      return;
    }
    if (data.inventory) setRows(data.inventory);
    else await load();
    setSaving(null);
  }

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Inventario</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">Unidades por talla.</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
        Cada color tiene su stock en cada talla. Empieza en 50. El medidor no descuenta hasta que
        eligen talla.
      </p>
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-10 space-y-8">
        {catalog.map((product) => (
          <section key={product.id} className="rounded-[1.6rem] bg-white/[0.04] p-4 sm:p-5">
            <h2 className="text-xl tracking-[-0.03em]">{productTitle(product.id)}</h2>
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
                  </tr>
                </thead>
                <tbody>
                  {product.finishes.map((finishId) => {
                    const finish = finishes[finishId];
                    return (
                      <tr key={finishId}>
                        <td className="pr-3">
                          <span className="flex items-center gap-2">
                            <span className="jewel" style={{ background: finish.swatch }} />
                            {finish.title}
                          </span>
                        </td>
                        {product.sizes.map((size) => {
                          const sku = inventorySku(product.id, finishId, size);
                          const row = rows.find((item) => item.sku === sku);
                          const units = row?.units ?? 0;
                          const reserved = row?.reserved ?? 0;
                          return (
                            <td key={size} className="px-0.5 align-top">
                              <input
                                type="number"
                                min={0}
                                defaultValue={units}
                                key={`${sku}-${units}`}
                                aria-label={`${productTitle(product.id)} ${finish.title} talla ${size}`}
                                title={reserved > 0 ? `${reserved} en checkout` : undefined}
                                onBlur={(event) => {
                                  const next = Number(event.target.value);
                                  if (Number.isFinite(next) && next !== units) void save(sku, next);
                                }}
                                className="h-10 w-14 rounded-xl bg-white/8 text-center text-[13px]"
                              />
                              {reserved > 0 ? (
                                <p className="mt-1 text-center text-[10px] text-white/40">{reserved} en checkout</p>
                              ) : null}
                              {saving === sku ? (
                                <p className="mt-1 text-center text-[10px] text-white/35">…</p>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
