"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BLACK_LABELS,
  BLACK_TEASER_HOURS,
  HORA_LOCA_MAX_SLOTS,
  HORA_LOCA_MINUTES,
  HORA_LOCA_TEASER_MINUTES,
  PROMO_PERCENTS,
  allPromoWindows,
  blackFridayOf,
  bogotaInputValue,
  fromBogotaInput,
  newSlotId,
  pickPromo,
  promoClockTime,
  promoMoment,
  slotEndsAt,
  type BlackConfig,
  type HoraLocaSlot,
  type PromoPercent,
  type PromoReport,
  type PromoSettings,
} from "@/commerce/promos";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { formatMoney } from "@/lib/catalog";
import { useAdminAuth } from "./AdminAuth";

type Payload = {
  ok?: boolean;
  error?: string;
  settings?: PromoSettings;
  reports?: PromoReport[];
  now?: number;
};

const DAY = 86_400_000;

function leftLabel(ms: number) {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${mins} min`;
  return `${Math.max(1, mins)} min`;
}

function pct(value: number) {
  return `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
}

export function PromosView() {
  const { authorizedFetch } = useAdminAuth();
  const [settings, setSettings] = useState<PromoSettings | null>(null);
  const [reports, setReports] = useState<PromoReport[]>([]);
  const [black, setBlack] = useState<BlackConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  // Hora del servidor: el panel dice «en vivo» con el mismo reloj que cobra.
  const [clock, setClock] = useState<{ offset: number; now: number } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  const take = useCallback((data: Payload) => {
    if (!data.ok || !data.settings) return false;
    setSettings(data.settings);
    setBlack(data.settings.black);
    setReports(data.reports ?? []);
    const serverNow = data.now ?? Date.now();
    setClock({ offset: serverNow - Date.now(), now: serverNow });
    return true;
  }, []);

  useEffect(() => {
    let alive = true;
    void authorizedFetch("/api/admin/promos")
      .then((res) => res.json())
      .then((data: Payload) => {
        if (!alive) return;
        if (!take(data)) setError(data.error || "No se pudieron leer las promociones.");
      })
      .catch(() => alive && setError("No se pudieron leer las promociones."));
    return () => {
      alive = false;
    };
  }, [authorizedFetch, take]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setClock((current) => (current ? { ...current, now: Date.now() + current.offset } : current)),
      15_000,
    );
    return () => {
      window.clearInterval(timer);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  async function save(patch: Record<string, unknown>, done: string) {
    setBusy(true);
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/promos", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as Payload;
      if (!take(data)) throw new Error(data.error || "No se pudo guardar.");
      flash(done);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!settings || !black || !clock) {
    return error ? (
      <div className="ventas-app">
        <h1 className="font-display text-4xl tracking-[-0.05em]">Promociones.</h1>
        <p className="text-sm text-[var(--admin-danger)]">{error}</p>
      </div>
    ) : (
      <div className="grid min-h-[40vh] place-items-center">
        <BrandLoader label="Cargando promociones" />
      </div>
    );
  }

  const now = clock.now;
  const windows = allPromoWindows(settings).filter((window) => window.endsAt > now);
  const current = pickPromo(windows, now);
  const upcoming = windows
    .filter((window) => window.startsAt > now)
    .sort((a, b) => a.startsAt - b.startsAt)[0];

  return (
    <div className="ventas-app max-w-4xl">
      <header>
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Operación</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">Promociones.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
          Black Friday y Hora Loca con cuenta regresiva en la tienda. El descuento se aplica solo
          a todo el pedido: el cliente no escribe ningún código. Si coincide con un código o con
          otra promoción, se cobra el descuento mayor; no se suman.
        </p>
      </header>

      {/* Colores escritos a mano: admin.css vuelve tinta las clases `text-white`. */}
      <section className="rounded-[1.1rem] bg-[#09090b] px-5 py-4 text-[#fff]">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-[rgba(255,255,255,0.58)]">
          {current?.phase === "live" ? "En vivo ahora" : current ? "Anunciándose" : "Ahora"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-[22px] tracking-[-0.03em]">
            {current
              ? `${current.label} · −${current.percent} %`
              : "Nada en vivo. La tienda vende a precio normal."}
          </p>
          <p className="text-[13px] text-[rgba(255,255,255,0.62)]">
            {current?.phase === "live"
              ? `Termina en ${leftLabel(current.endsAt - now)} · ${promoMoment(current.endsAt)}`
              : current
                ? `Empieza en ${leftLabel(current.startsAt - now)} · ${promoMoment(current.startsAt)}`
                : upcoming
                  ? `Sigue ${upcoming.label} · ${promoMoment(upcoming.startsAt)}`
                  : "Nada programado."}
          </p>
        </div>
      </section>

      {error ? <p className="text-[13px] text-[var(--admin-danger)]">{error}</p> : null}
      {toast ? <p className="text-[13px] text-[var(--admin-ok)]">{toast}</p> : null}

      <BlackCard
        draft={black}
        saved={settings.black}
        busy={busy}
        now={now}
        onChange={setBlack}
        onSave={(next, message) => save({ black: next }, message)}
      />

      <HoraLocaCard
        settings={settings}
        busy={busy}
        now={now}
        onSave={(next, message) => save({ horaLoca: next }, message)}
      />

      <Results reports={reports} />

      <p className="text-[12px] leading-5 text-[var(--admin-muted)]">
        Todas las horas son de Colombia. La tienda se entera sola en menos de un minuto.
        {process.env.NODE_ENV !== "production" ? (
          <>
            {" "}
            Vista previa local, sin guardar nada:{" "}
            <a className="underline" href="/?promo=black" target="_blank" rel="noreferrer">
              Black Friday
            </a>
            {" · "}
            <a className="underline" href="/?promo=hora" target="_blank" rel="noreferrer">
              Hora Loca
            </a>
            {" · "}
            <a className="underline" href="/?promo=black-teaser" target="_blank" rel="noreferrer">
              anuncio previo
            </a>
            {" · "}
            <a className="underline" href="/?promo=off" target="_blank" rel="noreferrer">
              quitar
            </a>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}

/* ── Black Friday / Black Week ── */

function BlackCard({
  draft,
  saved,
  busy,
  now,
  onChange,
  onSave,
}: {
  draft: BlackConfig;
  saved: BlackConfig;
  busy: boolean;
  now: number;
  onChange: (next: BlackConfig) => void;
  onSave: (next: BlackConfig, message: string) => Promise<boolean>;
}) {
  const dirty = JSON.stringify({ ...draft, enabled: saved.enabled }) !== JSON.stringify(saved);
  const ready = Boolean(draft.startsAt && draft.endsAt && draft.endsAt > draft.startsAt);
  const year = new Date(now).getUTCFullYear();
  const friday = blackFridayOf(blackFridayOf(year) + DAY > now ? year : year + 1);

  const state = !saved.enabled
    ? "Apagada"
    : saved.endsAt && saved.endsAt <= now
      ? "Terminó"
      : saved.startsAt && saved.startsAt <= now
        ? "En vivo"
        : "Programada";

  return (
    <section className="admin-sheet">
      <div className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-medium">{draft.label}</p>
            <Chip tone={state === "En vivo" ? "ok" : state === "Programada" ? "ink" : "muted"}>
              {state}
            </Chip>
          </div>
          <p className="mt-0.5 text-[12px] leading-5 text-[var(--admin-muted)]">
            {ready
              ? `−${draft.percent} % en toda la tienda. Del ${promoMoment(draft.startsAt!)} al ${promoMoment(draft.endsAt!)}`
              : "Pon el inicio y el final. La tienda cuenta hacia atrás hasta el final."}
          </p>
        </div>
        <Switch
          on={saved.enabled}
          disabled={busy || (!saved.enabled && !ready)}
          label={`Encender ${draft.label}`}
          onToggle={() =>
            void onSave(
              { ...draft, enabled: !saved.enabled },
              saved.enabled ? `${draft.label} apagada.` : `${draft.label} encendida.`,
            )
          }
        />
      </div>

      <div className="mt-3 grid sm:grid-cols-2">
        <div className="admin-field">
          <span>Nombre en la tienda</span>
          <Segmented
            value={draft.label}
            options={BLACK_LABELS.map((label) => ({ value: label, label }))}
            onChange={(label) => onChange({ ...draft, label })}
          />
        </div>
        <div className="admin-field sm:border-l sm:border-t-0">
          <span>Descuento</span>
          <Segmented
            value={draft.percent}
            options={PROMO_PERCENTS.map((value) => ({ value, label: `${value} %` }))}
            onChange={(percent) => onChange({ ...draft, percent })}
          />
        </div>
        <label className="admin-field">
          <span>Empieza</span>
          <input
            type="datetime-local"
            value={bogotaInputValue(draft.startsAt)}
            onChange={(event) => onChange({ ...draft, startsAt: fromBogotaInput(event.target.value) })}
            className="admin-input [color-scheme:light]"
          />
        </label>
        <label className="admin-field sm:border-l">
          <span>Termina</span>
          <input
            type="datetime-local"
            value={bogotaInputValue(draft.endsAt)}
            min={bogotaInputValue(draft.startsAt)}
            onChange={(event) => onChange({ ...draft, endsAt: fromBogotaInput(event.target.value) })}
            className="admin-input [color-scheme:light]"
          />
        </label>
        <div className="admin-field sm:col-span-2">
          <span>Anunciarla antes de que empiece</span>
          <Segmented
            value={draft.teaserHours}
            options={BLACK_TEASER_HOURS.map((hours) => ({
              value: hours,
              label: hours === 0 ? "No" : `${hours} h antes`,
            }))}
            onChange={(teaserHours) => onChange({ ...draft, teaserHours })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-line)] px-4 py-3 sm:px-5">
        <Shortcut
          onClick={() =>
            onChange({ ...draft, label: "Black Friday", startsAt: friday, endsAt: friday + DAY - 60_000 })
          }
        >
          Solo el viernes
        </Shortcut>
        <Shortcut
          onClick={() =>
            onChange({
              ...draft,
              label: "Black Week",
              startsAt: friday - 4 * DAY,
              endsAt: friday + 4 * DAY - 60_000,
            })
          }
        >
          Toda la semana, hasta el lunes
        </Shortcut>
        <button
          type="button"
          disabled={busy || !dirty || !ready}
          onClick={() => void onSave({ ...draft, enabled: saved.enabled }, "Guardado.")}
          className="admin-cta ml-auto h-10 w-auto px-5 text-[14px] disabled:opacity-40"
        >
          {busy ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}
        </button>
      </div>
    </section>
  );
}

/* ── Hora Loca ── */

function HoraLocaCard({
  settings,
  busy,
  now,
  onSave,
}: {
  settings: PromoSettings;
  busy: boolean;
  now: number;
  onSave: (next: Partial<PromoSettings["horaLoca"]>, message: string) => Promise<boolean>;
}) {
  const hora = settings.horaLoca;
  const [startsAt, setStartsAt] = useState("");
  const [minutes, setMinutes] = useState<number>(60);
  const [percent, setPercent] = useState<PromoPercent>(10);

  const pending = hora.slots.filter((slot) => slotEndsAt(slot) > now);
  const full = pending.length >= HORA_LOCA_MAX_SLOTS;

  async function add(start: number | null, message: string) {
    if (!start) return;
    const slot: HoraLocaSlot = { id: newSlotId(), startsAt: start, minutes, percent };
    // Programar una enciende la Hora Loca: no tiene sentido dejarla lista y apagada.
    const ok = await onSave({ enabled: true, slots: [...hora.slots, slot] }, message);
    if (ok) setStartsAt("");
  }

  return (
    <section className="admin-sheet">
      <div className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-medium">Hora Loca</p>
            <Chip tone={hora.enabled ? (pending.length ? "ink" : "muted") : "muted"}>
              {!hora.enabled ? "Apagada" : pending.length ? `${pending.length} por salir` : "Sin programar"}
            </Chip>
          </div>
          <p className="mt-0.5 text-[12px] leading-5 text-[var(--admin-muted)]">
            Un rato corto con descuento y el reloj en minutos y segundos. Programa varias: una por noche
            durante la semana, por ejemplo.
          </p>
        </div>
        <Switch
          on={hora.enabled}
          disabled={busy}
          label="Encender Hora Loca"
          onToggle={() =>
            void onSave({ enabled: !hora.enabled }, hora.enabled ? "Hora Loca apagada." : "Hora Loca encendida.")
          }
        />
      </div>

      {hora.slots.length ? (
        <ul className="mt-3 border-t border-[var(--admin-line)]">
          {hora.slots.map((slot) => {
            const end = slotEndsAt(slot);
            const state = end <= now ? "Terminó" : slot.startsAt <= now ? "En vivo" : "Programada";
            return (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-line)] px-4 py-3 last:border-b-0 sm:px-5"
              >
                <div className="min-w-0">
                  <p className={`text-[14px] ${state === "Terminó" ? "text-[var(--admin-muted)]" : ""}`}>
                    {promoMoment(slot.startsAt)} – {promoClockTime(end)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    −{slot.percent} % · {slot.minutes} min
                    {state === "Programada" ? ` · empieza en ${leftLabel(slot.startsAt - now)}` : ""}
                    {state === "En vivo" ? ` · quedan ${leftLabel(end - now)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Chip tone={state === "En vivo" ? "ok" : state === "Programada" ? "ink" : "muted"}>
                    {hora.enabled || state === "Terminó" ? state : "En pausa"}
                  </Chip>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (state === "En vivo" && !window.confirm("Está en vivo. ¿Terminarla ya?")) return;
                      void onSave(
                        { slots: hora.slots.filter((item) => item.id !== slot.id) },
                        state === "En vivo" ? "Hora Loca terminada." : "Quitada.",
                      );
                    }}
                    className="text-[12px] text-[var(--admin-muted)] underline-offset-2 hover:underline disabled:opacity-40"
                  >
                    {state === "En vivo" ? "Terminar ya" : "Quitar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-3 grid border-t border-[var(--admin-line)] sm:grid-cols-2">
        <label className="admin-field border-t-0 sm:col-span-2">
          <span>Empieza</span>
          <input
            type="datetime-local"
            value={startsAt}
            min={bogotaInputValue(now)}
            onChange={(event) => setStartsAt(event.target.value)}
            className="admin-input [color-scheme:light]"
          />
        </label>
        <div className="admin-field">
          <span>Dura</span>
          <Segmented
            value={minutes}
            options={HORA_LOCA_MINUTES.map((value) => ({ value, label: `${value} min` }))}
            onChange={setMinutes}
          />
        </div>
        <div className="admin-field sm:border-l">
          <span>Descuento</span>
          <Segmented
            value={percent}
            options={PROMO_PERCENTS.map((value) => ({ value, label: `${value} %` }))}
            onChange={setPercent}
          />
        </div>
        <div className="admin-field sm:col-span-2">
          <span>Anunciarla antes de que empiece</span>
          <Segmented
            value={hora.teaserMinutes}
            options={HORA_LOCA_TEASER_MINUTES.map((value) => ({
              value,
              label: value === 0 ? "No" : `${value} min antes`,
            }))}
            onChange={(teaserMinutes) => void onSave({ teaserMinutes }, "Guardado.")}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--admin-line)] px-4 py-3 sm:px-5">
        <p className="mr-auto text-[12px] text-[var(--admin-muted)]">
          {full ? `Máximo ${HORA_LOCA_MAX_SLOTS} a la vez. Quita una para programar otra.` : "Dos horas locas no se pueden cruzar."}
        </p>
        <button
          type="button"
          disabled={busy || full}
          onClick={() => {
            if (!window.confirm(`¿Empezar una Hora Loca ya? −${percent} % durante ${minutes} minutos en toda la tienda.`)) return;
            void add(now, "Hora Loca en vivo.");
          }}
          className="h-10 rounded-full bg-[var(--admin-field)] px-4 text-[13px] disabled:opacity-40"
        >
          Empezar ahora
        </button>
        <button
          type="button"
          disabled={busy || full || !fromBogotaInput(startsAt)}
          onClick={() => void add(fromBogotaInput(startsAt), "Hora Loca programada.")}
          className="admin-cta h-10 w-auto px-5 text-[14px] disabled:opacity-40"
        >
          {busy ? "Guardando…" : "Programar"}
        </button>
      </div>
    </section>
  );
}

/* ── Resultados ── */

function Results({ reports }: { reports: PromoReport[] }) {
  return (
    <section className="mt-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Resultados</p>
      <h2 className="mt-2 font-display text-3xl tracking-[-0.04em]">¿Sirvió?</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
        Cada edición guarda su propio embudo: quién entró con la promoción en vivo, hasta dónde
        llegó y cuánto se vendió. Se compara con la conversión de los 14 días anteriores.
      </p>

      {reports.length === 0 ? (
        <p className="mt-5 rounded-[1.1rem] bg-white px-5 py-6 text-[14px] text-[var(--admin-muted)] shadow-[var(--admin-shadow)]">
          Aún no ha corrido ninguna. La primera aparece aquí en cuanto empiece.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {reports.map((report) => (
            <li key={report.key} className="rounded-[1.1rem] bg-white px-5 py-4 shadow-[var(--admin-shadow)]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[15px] font-medium">
                    {report.label} · −{report.percent} %
                  </p>
                  <Chip tone={report.status === "live" ? "ok" : "muted"}>
                    {report.status === "live" ? "En vivo" : "Terminó"}
                  </Chip>
                </div>
                <p className="text-[12px] text-[var(--admin-muted)]">
                  {promoMoment(report.startsAt)} – {promoMoment(report.endsAt)}
                </p>
              </div>

              <p className="mt-3 text-[14px] leading-6">{report.verdict}</p>

              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <Stat label="Personas" value={String(report.visitors)} hint="Con la promoción en vivo" />
                <Stat
                  label="Conversión"
                  value={pct(report.conversion)}
                  hint={report.baseline ? `Antes: ${pct(report.baseline.conversion)}` : "Sin días previos"}
                />
                <Stat label="Pedidos pagados" value={String(report.orders)} hint={report.orders ? `Ticket ${formatMoney(report.ticket)}` : "—"} />
                <Stat label="Ventas" value={formatMoney(report.revenue)} hint={`Descuento dado ${formatMoney(report.discountCop)}`} />
              </dl>

              <div className="mt-4 border-t border-[var(--admin-line)] pt-3">
                <Funnel
                  steps={[
                    { label: "Entraron", value: report.visitors },
                    { label: "Vieron un anillo", value: report.sawProduct },
                    { label: "Al carrito", value: report.addedToCart },
                    { label: "Empezaron pedido", value: report.startedCheckout },
                    { label: "Llegaron a pagar", value: report.reachedPay },
                    { label: "Pagaron", value: report.orders },
                  ]}
                />
                <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
                  {report.clicks} {report.clicks === 1 ? "toque" : "toques"} en «Elegir» desde la franja o el reloj.
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((step) => step.value));
  return (
    <ul className="space-y-1.5">
      {steps.map((step) => (
        <li key={step.label} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 text-[12px]">
          <span className="text-[var(--admin-muted)]">{step.label}</span>
          <span className="h-1 overflow-hidden rounded-full bg-[var(--admin-field)]">
            <span
              className="block h-full rounded-full bg-[#1d1d1f]"
              style={{ width: `${Math.round((step.value / max) * 100)}%` }}
            />
          </span>
          <span className="text-right tabular-nums">{step.value}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Piezas ── */

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-1 text-[22px] font-semibold tracking-[-0.03em] tabular-nums">{value}</dd>
      <dd className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{hint}</dd>
    </div>
  );
}

function Chip({ tone, children }: { tone: "ok" | "ink" | "muted"; children: React.ReactNode }) {
  const style =
    tone === "ok"
      ? "bg-[rgba(31,122,56,0.1)] text-[var(--admin-ok)]"
      : tone === "ink"
        ? "bg-[#1d1d1f] text-white"
        : "bg-[var(--admin-field)] text-[var(--admin-muted)]";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${style}`}>{children}</span>;
}

function Shortcut({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-full bg-[var(--admin-field)] px-3 text-[12px] text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
    >
      {children}
    </button>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="mt-1 flex w-fit flex-wrap rounded-full bg-[var(--admin-field)] p-0.5 text-[12px]">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`h-8 rounded-full px-3 ${
            option.value === value ? "bg-[#1d1d1f] text-white" : "text-[var(--admin-muted)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Switch({
  on,
  disabled,
  label,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        on ? "bg-[#1d1d1f]" : "bg-[#d2d2d7]"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-[#fff] shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
