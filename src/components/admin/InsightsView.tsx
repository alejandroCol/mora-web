"use client";

import { useEffect, useState } from "react";
import { BrandLoader } from "@/components/brand/BrandLoader";
import type { InsightsReport } from "@/insights/types";
import { useAdminAuth } from "./AdminAuth";

const RANGES = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
] as const;

export function InsightsView() {
  const { authorizedFetch } = useAdminAuth();
  const [days, setDays] = useState<(typeof RANGES)[number]["days"]>(7);
  const [report, setReport] = useState<InsightsReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError("");
    void authorizedFetch(`/api/admin/insights?days=${days}`)
      .then(async (res) => {
        const data = (await res.json()) as { report?: InsightsReport; error?: string };
        if (cancelled) return;
        if (data.report) setReport(data.report);
        else setError(data.error || "No se pudo abrir el reporte.");
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo abrir el reporte.");
      });
    return () => {
      cancelled = true;
    };
  }, [authorizedFetch, days]);

  if (!report && !error) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <BrandLoader label="Leyendo la tienda" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="ventas-app">
        <h1 className="font-display text-4xl tracking-[-0.05em] text-[#f4f1ea]">Analítica.</h1>
        <p className="mt-3 text-sm text-[var(--admin-muted)]">{error}</p>
      </div>
    );
  }

  const maxProduct = Math.max(1, ...report.products.map((row) => row.viewers || row.views));
  const maxFunnel = Math.max(1, ...report.funnel.map((row) => row.visitors));
  const maxImage = Math.max(1, ...report.images.map((row) => row.viewers || row.views));
  const paid = report.funnel.find((row) => row.step === "purchase")?.visitors ?? 0;

  return (
    <div className="ventas-app">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Alcance</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.05em] text-[#f4f1ea]">
            Analítica.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
            Qué anillo miran, qué foto se quedan viendo y en qué paso se cae la venta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => setDays(range.days)}
              className={`h-10 rounded-full px-4 text-[12px] ${
                days === range.days ? "bg-white text-[#0e0d14]" : "bg-white/8 text-white/55"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </header>

      <div className="ventas-kpis">
        <Kpi label="Personas en la tienda" value={String(report.visitors)} hint={`Últimos ${report.days} días`} />
        <Kpi
          label="Vieron un anillo"
          value={String(report.funnel.find((row) => row.step === "product")?.visitors ?? 0)}
          hint="Pro o Ultra"
        />
        <Kpi
          label="Llegaron a pagar"
          value={String(report.funnel.find((row) => row.step === "pay")?.visitors ?? 0)}
          hint="Bold o Addi"
        />
        <Kpi label="Compraron" value={String(paid)} hint={`${report.conversion}% de quienes entraron`} />
      </div>

      {report.advice.map((note) => (
        <p
          key={note.text}
          className="rounded-[1.1rem] bg-white px-4 py-3 text-[13px] leading-6 text-[#1d1d1f] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
        >
          {note.text}
        </p>
      ))}

      <CaseOfferReport offer={report.caseOffer} />

      <section className="rounded-[1.1rem] bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        <h2 className="text-[15px] font-medium tracking-[-0.02em]">Dónde se cae la venta</h2>
        <p className="mt-1 text-[13px] text-[var(--admin-muted)]">
          De 100 que entran, cuántas siguen en cada paso. El hueco más grande está marcado.
        </p>
        <ol className="mt-5 space-y-3">
          {report.funnel.map((row) => {
            const leak = report.leak?.step === row.step && (row.drop ?? 0) > 0;
            return (
              <li key={row.step}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    {row.title}
                    {leak ? (
                      <span className="ml-2 text-[12px] text-[var(--admin-danger)]">
                        aquí se cayeron {row.drop}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[var(--admin-muted)]">
                    {row.visitors}
                    {row.fromPrevious != null ? ` · ${row.fromPrevious}% del paso anterior` : ""}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--admin-field)]">
                  <div
                    className={`h-full rounded-full ${leak ? "bg-[var(--admin-danger)]" : "bg-[#1d1d1f]"}`}
                    style={{ width: `${(row.visitors / maxFunnel) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{row.hint}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-[1.1rem] bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        <h2 className="text-[15px] font-medium tracking-[-0.02em]">Qué anillo miran más</h2>
        <ul className="mt-5 space-y-5">
          {report.products.map((row) => (
            <li key={row.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{row.id === "case" ? "Case" : `Mora ${row.name}`}</span>
                <span className="text-[var(--admin-muted)]">
                  {row.viewers || row.views} lo vieron
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--admin-field)]">
                <div
                  className="h-full rounded-full bg-[#1d1d1f]"
                  style={{ width: `${((row.viewers || row.views) / maxProduct) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
                {row.carts} a la bolsa · {row.purchases} compraron
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[1.1rem] bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        <h2 className="text-[15px] font-medium tracking-[-0.02em]">Qué foto se quedan viendo</h2>
        {report.images.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">
            Cuando alguien se quede un momento en una foto, aparece aquí.
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {report.images.map((row) => (
              <li
                key={row.id}
                className="flex gap-3 rounded-[1rem] bg-[var(--admin-field)] p-2.5"
              >
                <div className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[0.85rem] bg-white">
                  {row.kind === "ring" || !row.src ? (
                    <div className="grid h-full w-full place-items-center text-[11px] text-[var(--admin-muted)]">
                      3D
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.src} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 py-0.5">
                  <p className="truncate text-[13px]">{row.label}</p>
                  <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                    {row.viewers || row.views} personas
                    {row.views > row.viewers ? ` · ${row.views} veces` : ""}
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-[#1d1d1f]"
                      style={{ width: `${((row.viewers || row.views) / maxImage) * 100}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CaseOfferReport({
  offer,
}: {
  offer: InsightsReport["caseOffer"] | undefined;
}) {
  const shown = offer?.shown ?? 0;
  const added = offer?.added ?? 0;
  const dismissed = offer?.dismissed ?? 0;
  const paid = offer?.paid ?? 0;
  const addRate = offer?.addRate ?? 0;
  const dismissRate = offer?.dismissRate ?? 0;
  const payRate = offer?.payRate ?? 0;

  return (
    <section className="rounded-[1.1rem] bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
      <h2 className="text-[15px] font-medium tracking-[-0.02em]">Aviso del Case</h2>
      <p className="mt-1 text-[13px] text-[var(--admin-muted)]">
        Flotante en el último paso del pedido. Si se cierra mucho y pocos pagan, está
        estorbando. Si lo agregan, está ayudando.
      </p>
      {shown === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">
          Cuando alguien llegue a pagar sin Case, aquí se ve si el aviso funciona.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniKpi label="Lo vieron" value={String(shown)} hint="Llegaron a pagar sin Case" />
            <MiniKpi label="Lo agregaron" value={`${addRate}%`} hint={`${added} de ${shown}`} />
            <MiniKpi label="Lo cerraron" value={`${dismissRate}%`} hint={`${dismissed} de ${shown}`} />
            <MiniKpi label="Pagaron después" value={`${payRate}%`} hint={`${paid} de ${shown}`} />
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--admin-field)]">
            <div
              className="h-full rounded-full bg-[#1d1d1f]"
              style={{ width: `${Math.max(addRate, 2)}%` }}
              title="Quién lo agregó"
            />
          </div>
          <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
            {addRate >= 18
              ? "El aviso está sumando Cases al pedido."
              : dismissRate >= 50 && addRate < 12
                ? "Se cierra mucho. Puede estar frenando el pago."
                : payRate < 40 && dismissRate >= 35
                  ? "Vieron el aviso y pocos siguieron a pagar."
                  : "Todavía es pronto para un veredicto. Mira si pagan después de verlo."}
          </p>
        </>
      )}
    </section>
  );
}

function MiniKpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[0.95rem] bg-[var(--admin-field)] px-3 py-3">
      <p className="text-[11px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1.5 text-[1.25rem] font-medium tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-[var(--admin-muted)]">{hint}</p>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="ventas-kpi">
      <p className="text-[11px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{hint}</p>
    </div>
  );
}
