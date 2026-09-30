"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../AdminAuth";
import { ExpenseLedger } from "./ExpenseLedger";
import { FinanceOverview } from "./FinanceOverview";
import { LoanBook } from "./LoanBook";
import { PurchaseWorkbook } from "./PurchaseWorkbook";
import type { FinanceSnapshot } from "./types";

const TABS = [
  { id: "resumen", label: "Hoy" },
  { id: "gastos", label: "Gastos" },
  { id: "pedido", label: "Pedido" },
  { id: "prestamos", label: "Préstamos" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const empty: FinanceSnapshot = {
  expenses: [],
  loans: [],
  orders: [],
  attachments: [],
};

export function PresupuestoView() {
  const { authorizedFetch } = useAdminAuth();
  const [tab, setTab] = useState<Tab>("resumen");
  const [snapshot, setSnapshot] = useState<FinanceSnapshot>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apply = useCallback((data: Partial<FinanceSnapshot> & { ok?: boolean; error?: string }) => {
    if (data.ok === false) throw new Error(data.error || "No se pudo guardar.");
    setSnapshot({
      expenses: data.expenses ?? [],
      loans: data.loans ?? [],
      orders: data.orders ?? [],
      attachments: data.attachments ?? [],
    });
    return {
      expenses: data.expenses ?? [],
      loans: data.loans ?? [],
      orders: data.orders ?? [],
      attachments: data.attachments ?? [],
    };
  }, []);

  const mutate = useCallback(
    async (input: RequestInfo, init?: RequestInit) => {
      const res = await authorizedFetch(input, init);
      const data = (await res.json()) as Partial<FinanceSnapshot> & { ok?: boolean; error?: string };
      return apply(data);
    },
    [authorizedFetch, apply],
  );

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same mount fetch as GalleryView
    void mutate("/api/admin/finance")
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "No se pudo abrir.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mutate]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Presupuesto</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">La casa, en números.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
            Constitución, importación, el primer pedido y quién te prestó. Fácil de cambiar, claro
            al cerrar el mes.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-full bg-white/6 p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full px-3 py-1.5 text-[12px] ${
                tab === item.id ? "bg-white text-[#0e0d14]" : "text-white/55 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {error ? <p className="mt-6 text-sm text-red-300">{error}</p> : null}
      {loading ? (
        <p className="mt-10 text-white/40">Abriendo el libro…</p>
      ) : (
        <div className="mt-10">
          {tab === "resumen" ? (
            <FinanceOverview snapshot={snapshot} mutate={mutate} onOpen={setTab} />
          ) : null}
          {tab === "gastos" ? <ExpenseLedger snapshot={snapshot} mutate={mutate} /> : null}
          {tab === "pedido" ? <PurchaseWorkbook snapshot={snapshot} mutate={mutate} /> : null}
          {tab === "prestamos" ? <LoanBook snapshot={snapshot} mutate={mutate} /> : null}
        </div>
      )}
    </div>
  );
}
