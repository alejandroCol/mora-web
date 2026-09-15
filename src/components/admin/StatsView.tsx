"use client";

import { useEffect, useState } from "react";
import { PAYMENT_METHOD_LABEL } from "@/commerce/labels";
import { PAYMENT_METHODS, type DailyStats, type PaymentMethod } from "@/commerce/types";
import { formatMoney } from "@/lib/catalog";
import { useAdminAuth } from "./AdminAuth";

type Stats = {
  days: number;
  ordersCount: number;
  revenue: number;
  cancelledCount: number;
  awaiting: number;
  inTransit: number;
  ticket: number;
  byMethod: Record<PaymentMethod, { count: number; revenue: number }>;
  series: DailyStats[];
};

export function StatsView() {
  const { authorizedFetch } = useAdminAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    void authorizedFetch("/api/admin/stats")
      .then((res) => res.json())
      .then((data: { stats?: Stats }) => setStats(data.stats ?? null));
  }, [authorizedFetch]);

  if (!stats) {
    return <p className="text-white/40">Cargando el pulso…</p>;
  }

  const maxDay = Math.max(1, ...stats.series.map((day) => day.revenue));
  const maxMethod = Math.max(
    1,
    ...PAYMENT_METHODS.map((method) => stats.byMethod[method]?.revenue ?? 0),
  );

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Estadísticas</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">El atelier, en números.</h1>
      <p className="mt-2 text-sm text-white/45">Últimos {stats.days} días, separado por medio de pago.</p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ventas" value={formatMoney(stats.revenue)} />
        <Stat label="Pedidos" value={String(stats.ordersCount)} />
        <Stat label="Ticket" value={formatMoney(stats.ticket)} />
        <Stat label="En camino" value={String(stats.inTransit)} />
      </div>

      <section className="mt-10 rounded-[1.6rem] bg-white/[0.04] p-5">
        <h2 className="text-[15px]">Por medio de pago</h2>
        <ul className="mt-5 space-y-4">
          {PAYMENT_METHODS.map((method) => {
            const row = stats.byMethod[method] ?? { count: 0, revenue: 0 };
            return (
              <li key={method}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{PAYMENT_METHOD_LABEL[method]}</span>
                  <span className="text-white/50">
                    {row.count} · {formatMoney(row.revenue)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${(row.revenue / maxMethod) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6 rounded-[1.6rem] bg-white/[0.04] p-5">
        <h2 className="text-[15px]">Ritmo diario</h2>
        <div className="mt-6 flex h-40 items-end gap-1">
          {stats.series.length === 0 ? (
            <p className="text-sm text-white/40">Aún no hay ventas agregadas.</p>
          ) : (
            stats.series.map((day) => (
              <div key={day.date} className="flex h-full flex-1 flex-col justify-end">
                <div
                  className="rounded-t-md bg-white/80"
                  style={{ height: `${(day.revenue / maxDay) * 100}%` }}
                  title={`${day.date} · ${formatMoney(day.revenue)}`}
                />
              </div>
            ))
          )}
        </div>
        <p className="mt-4 text-[12px] text-white/35">{stats.cancelledCount} cancelados en el periodo.</p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] bg-white/[0.04] p-5">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className="mt-3 text-2xl tracking-[-0.04em]">{value}</p>
    </div>
  );
}
