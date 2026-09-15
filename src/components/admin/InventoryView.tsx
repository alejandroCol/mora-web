"use client";

import { useCallback, useEffect, useState } from "react";
import { inventorySku } from "@/commerce/sku";
import type { InventoryDoc } from "@/commerce/types";
import { catalog, finishes } from "@/lib/catalog";
import { useAdminAuth } from "./AdminAuth";

export function InventoryView() {
  const { authorizedFetch } = useAdminAuth();
  const [rows, setRows] = useState<InventoryDoc[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

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
    await authorizedFetch("/api/admin/inventory", {
      method: "PUT",
      body: JSON.stringify({ sku, units }),
    });
    await load();
    setSaving(null);
  }

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Inventario</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">Unidades por color.</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
        El stock se comparte entre tallas del mismo color. Al vender, se descuenta solo si hay
        unidades libres.
      </p>

      <div className="mt-10 space-y-8">
        {catalog.map((product) => (
          <section key={product.id}>
            <h2 className="text-xl tracking-[-0.03em]">{product.name}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {product.finishes.map((finishId) => {
                const sku = inventorySku(product.id, finishId);
                const row = rows.find((item) => item.sku === sku);
                const finish = finishes[finishId];
                const units = row?.units ?? 0;
                const reserved = row?.reserved ?? 0;
                return (
                  <article
                    key={sku}
                    className="flex items-center gap-4 rounded-[1.4rem] bg-white/[0.04] p-4"
                  >
                    <span className="jewel" style={{ background: finish.swatch }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px]">{finish.title}</p>
                      <p className="text-[12px] text-white/40">
                        {reserved > 0 ? `${reserved} en checkout` : "Libre"}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      defaultValue={units}
                      key={`${sku}-${units}`}
                      onBlur={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isFinite(next) && next !== units) void save(sku, next);
                      }}
                      className="h-11 w-20 rounded-2xl bg-white/8 text-center text-sm"
                    />
                    {saving === sku ? (
                      <span className="text-[11px] text-white/35">…</span>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
