"use client";

import { useState } from "react";
import { formatAdsMoney, formatCount } from "@/ads/format";
import type { AdsDecision, AdsMonitor, AdsVerdict } from "@/ads/types";
import { useAdsManage } from "./AdsManage";
import { BTN_DARK, BTN_SOFT, CARD, Thumb, timeLabel, useAdsApi } from "./adsUi";

const VERDICT: Record<AdsVerdict, { label: string; tone: string }> = {
  pause: { label: "Apagar", tone: "bg-[#fdecea] text-[var(--admin-danger)]" },
  scale: { label: "Subir", tone: "bg-[#e8f5ec] text-[var(--admin-ok)]" },
  fix: { label: "Corregir", tone: "bg-[#fdf1e4] text-[#b45309]" },
  keep: { label: "Dejar igual", tone: "bg-[var(--admin-field)] text-[#1d1d1f]" },
  watch: { label: "Vigilar", tone: "bg-[var(--admin-field)] text-[var(--admin-muted)]" },
};

/**
 * «Monitorear campañas ahora»: una lectura en vivo de Meta y del CRM que
 * devuelve decisiones con su porqué, y deja aplicarlas con un clic.
 */
export function AdsMonitorPanel() {
  const api = useAdsApi();
  const [monitor, setMonitor] = useState<AdsMonitor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    const result = await api.call<{ monitor: AdsMonitor }>("/api/admin/ads/monitor");
    setBusy(false);
    if (result.ok) setMonitor(result.data.monitor);
    else setError(result.error);
  }

  const money = (value: number) => formatAdsMoney(value, monitor?.currency ?? "COP");

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.1rem] bg-[#1d1d1f] p-5 text-white">
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#aeaeb2]">
            {monitor ? `Leído a las ${timeLabel(monitor.generatedAt)}` : "En vivo"}
          </p>
          <p className="mt-2 text-[17px] leading-7 tracking-[-0.02em]">
            {monitor
              ? monitor.headline
              : "Lee Meta y el CRM en este instante y te dice qué apagar, a qué subirle y qué corregir."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] px-5 text-[14px] font-medium text-[#1d1d1f] transition hover:bg-[#e5e5ea] disabled:opacity-60"
        >
          {busy ? "Leyendo Meta…" : monitor ? "Monitorear otra vez" : "Monitorear campañas ahora"}
        </button>
      </div>

      {error ? <p className={`${CARD} text-[13px] text-[var(--admin-danger)]`}>{error}</p> : null}

      {monitor ? (
        <div className="grid gap-3 text-[#1d1d1f]">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat
              label="Gastado hoy"
              value={money(monitor.today.spend)}
              hint={`de ${money(monitor.today.dailyBudget)} al día en ${monitor.today.activeCampaigns} ${monitor.today.activeCampaigns === 1 ? "campaña" : "campañas"}`}
            />
            <Stat
              label="Chats hoy"
              value={formatCount(monitor.today.chats)}
              hint={`${formatCount(monitor.week.chats)} en 7 días`}
            />
            <Stat
              label="Costo por chat"
              value={monitor.week.costPerChat > 0 ? money(monitor.week.costPerChat) : "—"}
              hint="Promedio de 7 días"
            />
            <Stat
              label="Ventas en 7 días"
              value={formatCount(monitor.week.sales)}
              hint={monitor.week.sales > 0 ? `${money(monitor.week.costPerSale)} cada una` : "Ninguna desde anuncios"}
            />
          </div>

          <div className={CARD}>
            <h3 className="text-[15px] font-medium tracking-[-0.02em]">Qué hacer ahora</h3>
            {monitor.decisions.length === 0 ? (
              <p className="mt-2 text-[13px] leading-6 text-[var(--admin-muted)]">
                Nada por decidir: no hay campañas activas con datos suficientes.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-black/[0.06]">
                {monitor.decisions.map((decision) => (
                  <DecisionRow key={decision.id} decision={decision} canManage={monitor.access.canManage} />
                ))}
              </ul>
            )}
          </div>

          <div className={CARD}>
            <h3 className="text-[15px] font-medium tracking-[-0.02em]">Lo que tiene que estar funcionando</h3>
            <ul className="mt-3 space-y-2.5">
              {monitor.health.map((check) => (
                <li key={check.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${
                      check.ok ? "bg-[#e8f5ec] text-[var(--admin-ok)]" : "bg-[#fdf1e4] text-[#b45309]"
                    }`}
                    aria-hidden
                  >
                    {check.ok ? "✓" : "!"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] text-[#1d1d1f]">{check.label}</span>
                    <span className="block text-[12.5px] leading-5 text-[var(--admin-muted)]">{check.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[1rem] bg-white px-3.5 py-3 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
      <p className="text-[11px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1.5 text-[1.3rem] font-medium tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-[11.5px] leading-4 text-[var(--admin-muted)]">{hint}</p>
    </div>
  );
}

function DecisionRow({ decision, canManage }: { decision: AdsDecision; canManage: boolean }) {
  const { act } = useAdsManage();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const verdict = VERDICT[decision.verdict];

  async function apply() {
    if (!decision.action) return;
    if (!window.confirm(`${decision.actionLabel}: «${decision.targetName}». ¿Aplicar ahora en Meta?`)) return;
    setState("busy");
    setError("");
    const problem = await act(decision.action, { reason: decision.why, source: "monitor" });
    if (problem) {
      setError(problem);
      setState("idle");
    } else {
      setState("done");
    }
  }

  return (
    <li className="flex flex-wrap gap-3.5 py-4 first:pt-0 last:pb-0">
      {decision.thumbnail ? (
        <Thumb src={decision.thumbnail} video={decision.isVideo} className="h-14 w-14 rounded-[0.8rem]" />
      ) : null}
      <div className="min-w-0 flex-1 basis-[16rem]">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${verdict.tone}`}>{verdict.label}</span>
          {decision.targetName ? (
            <span className="min-w-0 truncate text-[12px] text-[var(--admin-muted)]">
              {decision.level === "ad" ? `Anuncio · ${decision.campaignName}` : decision.targetName}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[15px] font-medium leading-6 tracking-[-0.02em] text-[#1d1d1f]">{decision.title}</p>
        <p className="mt-1 text-[13px] leading-6 text-[#1d1d1f]">{decision.why}</p>
        {decision.impact ? (
          <p className="mt-0.5 text-[13px] leading-6 text-[var(--admin-muted)]">{decision.impact}</p>
        ) : null}
        {decision.evidence.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {decision.evidence.map((item) => (
              <span
                key={item.label}
                className="rounded-full bg-[var(--admin-field)] px-2.5 py-1 text-[11.5px] text-[#1d1d1f]"
              >
                <span className="text-[var(--admin-muted)]">{item.label}</span> {item.value}
              </span>
            ))}
          </div>
        ) : null}
        {error ? <p className="mt-2 text-[12.5px] leading-5 text-[var(--admin-danger)]">{error}</p> : null}
      </div>
      {decision.action ? (
        <div className="flex shrink-0 flex-col items-end justify-center gap-1">
          {state === "done" ? (
            <span className="rounded-full bg-[#e8f5ec] px-3 py-1.5 text-[12.5px] text-[var(--admin-ok)]">Hecho</span>
          ) : (
            <button
              type="button"
              className={decision.verdict === "watch" ? BTN_SOFT : BTN_DARK}
              disabled={!canManage || state === "busy"}
              onClick={() => void apply()}
            >
              {state === "busy" ? "Aplicando…" : decision.actionLabel}
            </button>
          )}
          {!canManage ? <span className="text-[11px] text-[var(--admin-muted)]">Falta el permiso</span> : null}
        </div>
      ) : null}
    </li>
  );
}
