"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { formatAdsMoney } from "@/ads/format";
import type { AdRow, AdsAccess, AdsAction, AdsChange, AdsConnection, CampaignRow } from "@/ads/types";
import { BTN_DARK, BTN_SOFT, CARD, INPUT, dateTimeLabel, useAdsApi } from "./adsUi";

type Manage = {
  access: AdsAccess | null;
  /** Aplica un cambio en Meta. Devuelve "" si salió bien o el motivo si no. */
  act: (action: AdsAction, options?: { reason?: string; source?: "panel" | "monitor" }) => Promise<string>;
};

const ManageContext = createContext<Manage>({ access: null, act: async () => "Sin conexión." });

export function useAdsManage() {
  return useContext(ManageContext);
}

export function AdsManageProvider({
  access,
  onChanged,
  children,
}: {
  access: AdsAccess | null;
  onChanged: () => void;
  children: ReactNode;
}) {
  const api = useAdsApi();
  async function act(action: AdsAction, options: { reason?: string; source?: "panel" | "monitor" } = {}) {
    const result = await api.call<{ change: AdsChange }>("/api/admin/ads/manage", "POST", {
      action,
      reason: options.reason ?? "",
      source: options.source ?? "panel",
    });
    if (!result.ok) return result.error;
    onChanged();
    return "";
  }
  return <ManageContext.Provider value={{ access, act }}>{children}</ManageContext.Provider>;
}

/** Pausar o activar y cambiar el presupuesto diario, en la tarjeta de la campaña. */
export function CampaignControls({ campaign, currency }: { campaign: CampaignRow; currency: string }) {
  const { access, act } = useAdsManage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState("");
  if (!access?.canManage) return null;

  const money = (value: number) => formatAdsMoney(value, currency);
  const running = campaign.status === "ACTIVE";
  const canSwitch = running || campaign.status === "PAUSED";

  async function run(action: AdsAction) {
    setBusy(true);
    setError("");
    const problem = await act(action);
    setBusy(false);
    if (problem) setError(problem);
    else setEditing(false);
  }

  function toggle() {
    const question = running
      ? `¿Pausar «${campaign.name}»? Deja de gastar de inmediato.`
      : `¿Prender «${campaign.name}»?${campaign.dailyBudget ? ` Empieza a gastar hasta ${money(campaign.dailyBudget)} al día.` : ""}`;
    if (!window.confirm(question)) return;
    void run({ kind: "status", level: "campaign", id: campaign.id, value: running ? "PAUSED" : "ACTIVE" });
  }

  function saveBudget() {
    const value = Math.round(Number(budget.replace(/[^\d]/g, "")));
    if (!value) {
      setError("Escribe el presupuesto diario.");
      return;
    }
    if (!window.confirm(`¿Dejar «${campaign.name}» en ${money(value)} al día? Hoy tiene ${money(campaign.dailyBudget)}.`)) {
      return;
    }
    void run({ kind: "budget", level: "campaign", id: campaign.id, value });
  }

  return (
    <div className="mt-4 border-t border-black/[0.06] pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {canSwitch ? (
          <button type="button" className={running ? BTN_SOFT : BTN_DARK} disabled={busy} onClick={toggle}>
            {busy && !editing ? "Aplicando…" : running ? "Pausar" : "Prender"}
          </button>
        ) : null}
        {campaign.budgetAtCampaign && !editing ? (
          <button
            type="button"
            className={BTN_SOFT}
            disabled={busy}
            onClick={() => {
              setBudget(String(Math.round(campaign.dailyBudget)));
              setEditing(true);
              setError("");
            }}
          >
            Cambiar presupuesto
          </button>
        ) : null}
        {editing ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveBudget();
            }}
          >
            <input
              className={`${INPUT} !h-9 !w-36`}
              inputMode="numeric"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              aria-label="Presupuesto diario"
              autoFocus
            />
            <span className="text-[12px] text-[var(--admin-muted)]">al día</span>
            <button type="submit" className={BTN_DARK} disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className={BTN_SOFT} disabled={busy} onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </form>
        ) : null}
        {!campaign.budgetAtCampaign && campaign.dailyBudget > 0 ? (
          <span className="text-[12px] text-[var(--admin-muted)]">
            El presupuesto de esta campaña va por conjunto: se cambia en Meta.
          </span>
        ) : null}
      </div>
      {editing && access.minDailyBudget > 0 ? (
        <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
          Mínimo de Meta: {money(access.minDailyBudget)}. Subir más de 20 % de un golpe reinicia el aprendizaje.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[12.5px] leading-5 text-[var(--admin-danger)]">{error}</p> : null}
    </div>
  );
}

/** Pausar o activar un anuncio suelto. */
export function AdSwitch({ ad }: { ad: AdRow }) {
  const { access, act } = useAdsManage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!access?.canManage) return null;
  // «Campaña en pausa» no se arregla prendiendo el anuncio: solo se ofrece lo que sí cambia algo.
  const running = ad.status === "ACTIVE" || ad.status === "CAMPAIGN_PAUSED" || ad.status === "ADSET_PAUSED";
  if (!running && ad.status !== "PAUSED") return null;

  async function toggle() {
    if (!window.confirm(running ? `¿Pausar el anuncio «${ad.name}»?` : `¿Prender el anuncio «${ad.name}»?`)) return;
    setBusy(true);
    setError("");
    const problem = await act({ kind: "status", level: "ad", id: ad.id, value: running ? "PAUSED" : "ACTIVE" });
    setBusy(false);
    setError(problem);
  }

  return (
    <div className="shrink-0 self-center text-right">
      <button
        type="button"
        className="rounded-full bg-[var(--admin-card)] px-3 py-1.5 text-[12px] text-[#1d1d1f] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] disabled:opacity-45"
        disabled={busy}
        onClick={() => void toggle()}
      >
        {busy ? "…" : running ? "Pausar" : "Prender"}
      </button>
      {error ? <p className="mt-1 max-w-[11rem] text-[11px] leading-4 text-[var(--admin-danger)]">{error}</p> : null}
    </div>
  );
}

const TOKEN_STEPS = [
  "En business.facebook.com entra a Configuración › Usuarios › Usuarios del sistema y abre el de Mora.",
  "Asignar activos › Cuentas publicitarias › Mora Ring › activa «Administrar campañas».",
  "Asignar activos › Páginas › Mora Ring › activa «Anuncios». Sin eso Meta no deja crear anuncios con las publicaciones.",
  "Asignar activos › Conjuntos de datos › el Pixel de Mora › control total. Así también llegan las ventas a Meta.",
  "Generar token › app de Mora › caducidad «Nunca». Marca ads_management, ads_read, business_management, pages_show_list, pages_read_engagement, instagram_basic, whatsapp_business_management y whatsapp_business_manage_events.",
  "Pégalo aquí. El token anterior sigue sirviendo para WhatsApp e Instagram: no hay que cambiarlo allá.",
];

/** Qué falta para que Mora pueda cambiar anuncios, y dónde pegar el token nuevo. */
export function AccessCard({
  access,
  connection,
  onUpdated,
}: {
  access: AdsAccess;
  connection: AdsConnection;
  onUpdated: (access: AdsAccess) => void;
}) {
  const api = useAdsApi();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const result = await api.call<{ access: AdsAccess }>("/api/admin/ads/manage?fresh=1");
    if (result.ok) onUpdated(result.data.access);
    return result;
  }

  async function connect() {
    setBusy(true);
    setError("");
    const saved = await api.call("/api/admin/ads/connection", "POST", { token, accountId: connection.accountId });
    if (!saved.ok) {
      setBusy(false);
      setError(saved.error);
      return;
    }
    const checked = await refresh();
    setBusy(false);
    setToken("");
    if (checked.ok && !checked.data.access.canManage) {
      setError(`El token quedó guardado, pero todavía falta: ${checked.data.access.missing.join(" ")}`);
    }
  }

  async function recheck() {
    setBusy(true);
    setError("");
    const checked = await refresh();
    setBusy(false);
    if (!checked.ok) setError(checked.error);
  }

  return (
    <section className={CARD}>
      <h2 className="text-[15px] font-medium tracking-[-0.02em]">Hoy Mora solo puede ver los anuncios</h2>
      <p className="mt-1 text-[13px] leading-6 text-[var(--admin-muted)]">
        Para pausar, cambiar presupuesto, crear campañas y audiencias desde aquí hace falta un token con más
        permiso. Es una sola vez.
      </p>
      <ul className="mt-3 space-y-1.5">
        {access.missing.map((item) => (
          <li key={item} className="flex gap-2.5 text-[13px] leading-6 text-[#1d1d1f]">
            <span className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#b45309]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <details className="group mt-4">
        <summary className="cursor-pointer list-none text-[13px] text-[#1d1d1f]">
          <span className="group-open:hidden">Cómo se hace, paso a paso ›</span>
          <span className="hidden group-open:inline">Ocultar pasos</span>
        </summary>
        <ol className="mt-3 space-y-2">
          {TOKEN_STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-[13px] leading-6 text-[#1d1d1f]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--admin-field)] text-[11px]">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </details>
      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void connect();
        }}
      >
        <input
          className={`${INPUT} min-w-[14rem] flex-1`}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Token nuevo (EAAG…)"
          autoComplete="off"
          spellCheck={false}
          aria-label="Token nuevo"
        />
        <button type="submit" className={BTN_DARK} disabled={busy || token.trim().length < 40}>
          {busy ? "Revisando…" : "Guardar token"}
        </button>
        <button type="button" className={BTN_SOFT} disabled={busy} onClick={() => void recheck()}>
          Volver a revisar
        </button>
      </form>
      {error ? <p className="mt-3 text-[13px] leading-6 text-[var(--admin-danger)]">{error}</p> : null}
    </section>
  );
}

const SOURCE_LABEL = { panel: "Panel", monitor: "Monitor", pilot: "Piloto" } as const;

export function ChangesLog({ changes }: { changes: AdsChange[] }) {
  if (changes.length === 0) {
    return (
      <p className="text-[13px] leading-6 text-[var(--admin-muted)]">
        Todavía no se ha cambiado nada desde Mora. Todo lo que se pause, se prenda, se cree o cambie de presupuesto
        queda anotado aquí con quién lo hizo y por qué.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-black/[0.06]">
      {changes.map((change) => (
        <li key={change.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="min-w-0 text-[13.5px] text-[#1d1d1f]">
              <span className={change.ok ? "" : "text-[var(--admin-danger)]"}>
                {change.ok ? "" : "No se pudo: "}
                {change.before ? `${change.before} → ${change.after}` : change.after}
              </span>
            </p>
            <p className="shrink-0 text-[11.5px] text-[var(--admin-muted)]">
              {dateTimeLabel(change.at)} · {SOURCE_LABEL[change.source]} · {change.byName}
            </p>
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--admin-muted)]">{change.targetName}</p>
          {change.reason || change.error ? (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-[var(--admin-muted)]">
              {change.error || change.reason}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
