"use client";

import { useEffect, useState } from "react";
import { formatAdsMoney } from "@/ads/format";
import type { AdsAccess, AdsChange, AdsPilotRun, AdsPilotSettings } from "@/ads/types";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { ChangesLog } from "./AdsManage";
import { BTN_DARK, BTN_SOFT, CARD, INPUT, SectionTitle, Switch, dateTimeLabel, useAdsApi } from "./adsUi";

type Payload = { settings: AdsPilotSettings; runs: AdsPilotRun[]; access: AdsAccess };

type NumberKey =
  | "targetCostPerChat"
  | "targetCostPerSale"
  | "minSpendToJudge"
  | "maxDailyTotal"
  | "maxDailyPerCampaign"
  | "scaleStepPct";

const GOALS: { key: NumberKey; label: string; hint: string }[] = [
  {
    key: "targetCostPerChat",
    label: "Máximo por chat",
    hint: "Lo que estás dispuesto a pagar por una conversación. Al doble de esto, se recomienda apagar.",
  },
  {
    key: "targetCostPerSale",
    label: "Máximo por venta",
    hint: "Lo que puede costar en anuncios conseguir un pedido pagado.",
  },
  {
    key: "minSpendToJudge",
    label: "Gasto mínimo para juzgar",
    hint: "Antes de esto no se apaga nada: aún no hay datos.",
  },
];

const LIMITS: { key: NumberKey; label: string; hint: string }[] = [
  {
    key: "maxDailyTotal",
    label: "Tope diario de toda la cuenta",
    hint: "Nadie (ni tú desde aquí, ni el piloto) puede dejar activo más que esto al día.",
  },
  {
    key: "maxDailyPerCampaign",
    label: "Tope diario por campaña",
    hint: "Ninguna campaña se crea ni se sube por encima de esto.",
  },
  {
    key: "scaleStepPct",
    label: "Cuánto sube cada vez (%)",
    hint: "Entre 5 y 30. Más de 20 % de un golpe reinicia el aprendizaje de Meta.",
  },
];

/** Metas, topes y el piloto: qué puede hacer Mora sola y hasta dónde. */
export function AdsPilotPanel({ currency }: { currency: string }) {
  const api = useAdsApi();
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<AdsPilotSettings | null>(null);
  const [changes, setChanges] = useState<AdsChange[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "run">("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api.call<Payload>("/api/admin/ads/pilot"),
      api.call<{ changes: AdsChange[] }>("/api/admin/ads/manage"),
    ]).then(([pilot, log]) => {
      if (cancelled) return;
      if (pilot.ok) {
        setData(pilot.data);
        setDraft(pilot.data.settings);
      } else {
        setError(pilot.error);
      }
      if (log.ok) setChanges(log.data.changes);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (!data || !draft) {
    return error ? (
      <p className={`${CARD} text-[13px] text-[var(--admin-danger)]`}>{error}</p>
    ) : (
      <div className="grid min-h-[30vh] place-items-center">
        <BrandLoader label="Leyendo el piloto" />
      </div>
    );
  }

  const money = (value: number) => formatAdsMoney(value, currency);
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);
  const set = (patch: Partial<AdsPilotSettings>) => {
    setDraft({ ...draft, ...patch });
    setNote("");
  };

  async function save() {
    setBusy("save");
    setError("");
    const result = await api.call<{ settings: AdsPilotSettings }>("/api/admin/ads/pilot", "PUT", { settings: draft });
    setBusy("");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setData({ ...data!, settings: result.data.settings });
    setDraft(result.data.settings);
    setNote("Guardado.");
  }

  async function runNow() {
    const question = data!.settings.enabled
      ? "El piloto va a leer las campañas y aplicar lo que tus ajustes permiten. ¿Correr ahora?"
      : "El piloto está apagado: solo va a dejar sugerencias, sin cambiar nada. ¿Correr ahora?";
    if (!window.confirm(question)) return;
    setBusy("run");
    setError("");
    const result = await api.call<{ run: AdsPilotRun; runs: AdsPilotRun[] }>("/api/admin/ads/pilot", "POST");
    setBusy("");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setData({ ...data!, runs: result.data.runs });
    const applied = result.data.run.applied.filter((item) => item.ok).length;
    setNote(
      applied > 0
        ? `Aplicó ${applied} ${applied === 1 ? "cambio" : "cambios"}.`
        : `No cambió nada. Dejó ${result.data.run.suggested} ${result.data.run.suggested === 1 ? "sugerencia" : "sugerencias"}.`,
    );
    const log = await api.call<{ changes: AdsChange[] }>("/api/admin/ads/manage");
    if (log.ok) setChanges(log.data.changes);
  }

  const field = (item: { key: NumberKey; label: string; hint: string }) => (
    <label key={item.key} className="grid gap-1.5">
      <span className="text-[12px] text-[var(--admin-muted)]">{item.label}</span>
      <input
        className={INPUT}
        inputMode="numeric"
        value={String(draft[item.key])}
        onChange={(event) => set({ [item.key]: Math.round(Number(event.target.value.replace(/[^\d]/g, ""))) || 0 })}
      />
      <span className="text-[11.5px] leading-4 text-[var(--admin-muted)]">{item.hint}</span>
    </label>
  );

  return (
    <div className="grid gap-4">
      <section className={CARD}>
        <SectionTitle
          title="Piloto automático"
          hint="Tres veces al día (8 a. m., 2 p. m. y 8 p. m.) hace lo mismo que el botón de monitorear y, si lo dejas, actúa. Todo queda anotado abajo."
        />
        <div className="mt-4 grid gap-4">
          <Switch
            on={draft.enabled}
            onChange={(enabled) => set({ enabled })}
            label="Dejar que el piloto actúe"
            hint="Apagado solo sugiere. Prendido aplica lo que marques aquí abajo, dentro de tus topes."
          />
          <Switch
            on={draft.autoPause}
            onChange={(autoPause) => set({ autoPause })}
            disabled={!draft.enabled}
            label="Puede apagar lo que quema plata"
            hint="Campañas que no buscan ventas, o que ya gastaron lo suficiente sin chats o al doble de tu máximo."
          />
          <Switch
            on={draft.autoScale}
            onChange={(autoScale) => set({ autoScale })}
            disabled={!draft.enabled}
            label="Puede subir presupuesto a lo que vende"
            hint={`Solo campañas con ventas dentro de tu máximo, de a ${draft.scaleStepPct} % y como mucho una vez cada 3 días.`}
          />
        </div>
        {!data.access.canManage ? (
          <p className="mt-4 text-[12.5px] leading-5 text-[#b45309]">
            Aún no puede actuar: falta el permiso de administrar anuncios (míralo en Resultados). Mientras tanto solo
            sugiere.
          </p>
        ) : null}
        {!data.runs.some((run) => run.trigger === "schedule") ? (
          <p className="mt-2 text-[12.5px] leading-5 text-[#b45309]">
            La pasada programada todavía no ha corrido ninguna vez. Hasta que corra, el piloto solo trabaja cuando le
            das «Correr el piloto ahora».
          </p>
        ) : null}
      </section>

      <section className={CARD}>
        <SectionTitle title="Tus metas" hint="Con esto se decide qué es caro y qué es barato para Mora." />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">{GOALS.map(field)}</div>
      </section>

      <section className={CARD}>
        <SectionTitle
          title="Topes"
          hint={`Hoy: ${money(draft.maxDailyTotal)} al día en total, que al mes son unos ${money(draft.maxDailyTotal * 30)}.`}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">{LIMITS.map(field)}</div>
        <label className="mt-4 grid gap-1.5 sm:max-w-sm">
          <span className="text-[12px] text-[var(--admin-muted)]">Correo para el resumen de la mañana</span>
          <input
            className={INPUT}
            type="email"
            value={draft.notifyEmail}
            onChange={(event) => set({ notifyEmail: event.target.value })}
            placeholder="Vacío: no se envía"
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_DARK} disabled={!dirty || busy !== ""} onClick={() => void save()}>
          {busy === "save" ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className={BTN_SOFT} disabled={dirty || busy !== ""} onClick={() => void runNow()}>
          {busy === "run" ? "Corriendo…" : "Correr el piloto ahora"}
        </button>
        {note ? <span className="text-[13px] text-[var(--admin-ok)]">{note}</span> : null}
        {error ? <span className="text-[13px] text-[var(--admin-danger)]">{error}</span> : null}
      </div>

      <section className={CARD}>
        <SectionTitle title="Últimas pasadas del piloto" />
        {data.runs.length === 0 ? (
          <p className="mt-3 text-[13px] leading-6 text-[var(--admin-muted)]">Todavía no ha corrido.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/[0.06]">
            {data.runs.map((run) => (
              <li key={run.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[11.5px] text-[var(--admin-muted)]">
                  {dateTimeLabel(run.at)} · {run.trigger === "schedule" ? "Programada" : "A mano"}
                </p>
                <p className="mt-0.5 text-[13.5px] leading-6 text-[#1d1d1f]">{run.headline}</p>
                {run.applied.map((item) => (
                  <p
                    key={`${item.title}:${item.target}`}
                    className={`text-[12.5px] leading-5 ${item.ok ? "text-[var(--admin-ok)]" : "text-[var(--admin-danger)]"}`}
                  >
                    {item.ok ? "Hecho" : "No se pudo"}: {item.title} · {item.target}
                    {item.error ? ` · ${item.error}` : ""}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={CARD}>
        <SectionTitle title="Cambios hechos desde Mora" />
        <div className="mt-3">
          <ChangesLog changes={changes} />
        </div>
      </section>
    </div>
  );
}
