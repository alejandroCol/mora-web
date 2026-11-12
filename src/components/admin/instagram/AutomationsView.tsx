"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { formatWhen } from "@/crm/labels";
import {
  emptyAutomation,
  type InstagramAutomation,
  type InstagramAutomationInput,
  type InstagramCommentEvent,
  type InstagramConnectionStatus,
  type InstagramEventStatus,
  type InstagramMediaItem,
} from "@/instagram/types";
import { useAdminAuth } from "../AdminAuth";
import { AutomationEditor } from "./AutomationEditor";
import { InstagramConnectionCard } from "./InstagramConnectionCard";

type Payload = {
  ok?: boolean;
  error?: string;
  warning?: string;
  status?: InstagramConnectionStatus;
  automations?: InstagramAutomation[];
  events?: InstagramCommentEvent[];
  media?: InstagramMediaItem[];
};

/** `id` vacío = regla nueva (o copia de otra). */
type Editing = { id: string; title: string; initial: InstagramAutomationInput };

const EVENT_LABEL: Record<InstagramEventStatus, string> = {
  processing: "Enviando",
  sent: "Enviado",
  failed: "Falló",
  deferred: "En cola",
  skipped: "Ya lo tenía",
};

const EVENT_TONE: Record<InstagramEventStatus, string> = {
  processing: "bg-[var(--admin-field)] text-[var(--admin-muted)]",
  sent: "bg-[rgba(31,122,56,0.1)] text-[var(--admin-ok)]",
  failed: "bg-[rgba(180,35,24,0.08)] text-[var(--admin-danger)]",
  deferred: "bg-[rgba(180,83,9,0.1)] text-[#92400e]",
  skipped: "bg-[var(--admin-field)] text-[var(--admin-muted)]",
};

function inputOf(rule: InstagramAutomation): InstagramAutomationInput {
  return {
    name: rule.name,
    active: rule.active,
    scope: rule.scope,
    media: rule.media,
    trigger: rule.trigger,
    keywords: rule.keywords,
    publicReplies: rule.publicReplies,
    dmText: rule.dmText,
    dmButtonLabel: rule.dmButtonLabel,
    dmButtonUrl: rule.dmButtonUrl,
    oncePerPerson: rule.oncePerPerson,
  };
}

function describe(rule: InstagramAutomation) {
  const shown = rule.keywords.slice(0, 4).map((keyword) => `«${keyword}»`);
  const extra = rule.keywords.length - shown.length;
  const when =
    rule.trigger === "any"
      ? "Cualquier comentario"
      : `Comentan ${shown.join(", ")}${extra > 0 ? ` y ${extra} más` : ""}`;
  const where =
    rule.scope === "all"
      ? "en cualquier publicación"
      : `en ${rule.media.length} ${rule.media.length === 1 ? "publicación" : "publicaciones"}`;
  return `${when} ${where}`;
}

export function AutomationsView() {
  const { authorizedFetch } = useAdminAuth();
  const [status, setStatus] = useState<InstagramConnectionStatus | null>(null);
  const [automations, setAutomations] = useState<InstagramAutomation[]>([]);
  const [events, setEvents] = useState<InstagramCommentEvent[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const apply = useCallback((data: Payload) => {
    if (data.status) setStatus(data.status);
    if (data.automations) setAutomations(data.automations);
    if (data.events) setEvents(data.events);
  }, []);

  const load = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/instagram");
    const data = (await res.json()) as Payload;
    if (!res.ok || data.ok === false) {
      setError(data.error || "No se pudo leer Automatizaciones.");
      return;
    }
    apply(data);
  }, [apply, authorizedFetch]);

  // El historial se refresca solo: quien prueba una regla ve llegar el comentario sin recargar.
  useEffect(() => {
    const start = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20_000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [load]);

  /** Devuelve la respuesta si salió bien; si no, deja el error donde `onError` diga. */
  async function mutate(key: string, input: RequestInfo, init: RequestInit, onError = setError) {
    setBusy(key);
    onError("");
    try {
      const res = await authorizedFetch(input, init);
      const data = (await res.json()) as Payload;
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo guardar.");
      apply(data);
      return data;
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "No se pudo guardar.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  const loadMedia = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/instagram/media");
    const data = (await res.json()) as Payload;
    if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudieron leer las publicaciones.");
    return data.media ?? [];
  }, [authorizedFetch]);

  const closeEditor = useCallback(() => {
    setEditing(null);
    setEditorError("");
  }, []);

  async function save(input: InstagramAutomationInput) {
    if (!editing) return;
    const data = await mutate(
      "save",
      editing.id ? `/api/admin/instagram/automations/${editing.id}` : "/api/admin/instagram/automations",
      { method: editing.id ? "PATCH" : "POST", body: JSON.stringify(input) },
      setEditorError,
    );
    if (!data) return;
    closeEditor();
    flash(editing.id ? "Regla guardada." : "Regla creada.");
  }

  async function toggle(rule: InstagramAutomation) {
    const data = await mutate(rule.id, `/api/admin/instagram/automations/${rule.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !rule.active }),
    });
    if (data) flash(rule.active ? `${rule.name} en pausa.` : `${rule.name} activa.`);
  }

  async function remove(rule: InstagramAutomation) {
    if (!window.confirm(`¿Borrar la regla ${rule.name}? El historial se conserva.`)) return;
    const data = await mutate(rule.id, `/api/admin/instagram/automations/${rule.id}`, { method: "DELETE" });
    if (data) flash("Regla borrada.");
  }

  async function retry(event: InstagramCommentEvent) {
    const data = await mutate(event.id, `/api/admin/instagram/events/${event.id}`, { method: "POST" });
    if (data) flash("Reintentado.");
  }

  const stats = useMemo(
    () => ({
      active: automations.filter((rule) => rule.active).length,
      sent: automations.reduce((sum, rule) => sum + rule.sent, 0),
      pending: events.filter((event) => event.status === "failed" || event.status === "deferred").length,
    }),
    [automations, events],
  );

  if (!status) {
    return (
      <div className="ventas-app">
        <Heading />
        {error ? (
          <p className="text-[13px] text-[var(--admin-danger)]">{error}</p>
        ) : (
          <div className="grid min-h-[30vh] place-items-center">
            <BrandLoader label="Cargando automatizaciones" />
          </div>
        )}
      </div>
    );
  }

  const nearCap = status.sentThisHour >= status.hourlyCap * 0.9;

  return (
    <div className="ventas-app">
      <Heading />

      <InstagramConnectionCard
        status={status}
        busy={busy === "connection"}
        registering={busy === "webhook"}
        onRegisterWebhook={() =>
          void mutate("webhook", "/api/admin/instagram/connection", { method: "PUT" }).then((data) => {
            if (data) flash("Webhook registrado en Meta.");
          })
        }
        onConnect={async (token) => {
          const data = await mutate("connection", "/api/admin/instagram/connection", {
            method: "POST",
            body: JSON.stringify({ token }),
          });
          if (!data) return false;
          if (data.warning) setError(data.warning);
          else flash("Instagram conectado.");
          return true;
        }}
        onDisconnect={() => void mutate("connection", "/api/admin/instagram/connection", { method: "DELETE" })}
        onHumanAgent={(humanAgent) =>
          void mutate("connection", "/api/admin/instagram/connection", {
            method: "PATCH",
            body: JSON.stringify({ humanAgent }),
          })
        }
      />

      {error ? <p className="text-[13px] text-[var(--admin-danger)]">{error}</p> : null}

      <div className="ventas-kpis">
        <Kpi label="Reglas activas" value={String(stats.active)} hint={`${automations.length} en total`} />
        <Kpi label="Mensajes enviados" value={String(stats.sent)} hint="Desde que existen las reglas" />
        <Kpi
          label="Esta hora"
          value={`${status.sentThisHour} / ${status.hourlyCap}`}
          hint={nearCap ? "Cerca del tope: lo demás espera en cola" : "Tope de Instagram por hora"}
          alert={nearCap}
        />
        <Kpi
          label="Por revisar"
          value={String(stats.pending)}
          hint="Fallidos o en cola"
          alert={stats.pending > 0}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium">Reglas</h2>
        <button
          type="button"
          onClick={() => setEditing({ id: "", title: "Nueva regla", initial: emptyAutomation() })}
          className="admin-cta auto-cta"
        >
          Nueva regla
        </button>
      </div>

      {automations.length === 0 ? (
        <div className="rounded-[1.25rem] bg-white px-5 py-8 shadow-[var(--admin-shadow)]">
          <p className="text-[14px]">Aún no hay reglas.</p>
          <p className="mt-1 max-w-lg text-[13px] leading-6 text-[var(--admin-muted)]">
            Ejemplo: en tu próximo reel di «comenta ULTRA y te mando el precio». Crea la regla con la palabra ULTRA y
            el mensaje. Cada persona que comente lo recibe por DM en segundos.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {automations.map((rule) => {
            const working = busy === rule.id;
            return (
              <li key={rule.id} className="ventas-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-medium">{rule.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          rule.active
                            ? "bg-[rgba(31,122,56,0.1)] text-[var(--admin-ok)]"
                            : "bg-[var(--admin-field)] text-[var(--admin-muted)]"
                        }`}
                      >
                        {rule.active ? "Activa" : "En pausa"}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--admin-muted)]">{describe(rule)}</p>
                    <p className="mt-1 line-clamp-2 max-w-2xl text-[13px] leading-5">{rule.dmText}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                      {rule.sent} {rule.sent === 1 ? "enviado" : "enviados"}
                      {rule.failed > 0 ? ` · ${rule.failed} con fallo` : ""}
                      {rule.lastSentAt ? ` · último ${formatWhen(rule.lastSentAt)}` : ""}
                      {rule.publicReplies.length > 0 ? " · responde en público" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void toggle(rule)}
                    className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px] disabled:opacity-40"
                  >
                    {rule.active ? "Pausar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: rule.id, title: rule.name, initial: inputOf(rule) })}
                    className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        id: "",
                        title: "Copia de regla",
                        // La copia nace en pausa: dos reglas iguales activas no aportan nada.
                        initial: { ...inputOf(rule), name: `${rule.name} (copia)`.slice(0, 60), active: false },
                      })
                    }
                    className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px]"
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void remove(rule)}
                    className="ml-auto h-9 rounded-full px-4 text-[12px] text-[var(--admin-danger)] hover:bg-red-50 disabled:opacity-40"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-2 text-[15px] font-medium">Actividad</h2>
      {events.length === 0 ? (
        <p className="rounded-[1.25rem] bg-white px-5 py-6 text-[13px] text-[var(--admin-muted)] shadow-[var(--admin-shadow)]">
          Aquí aparece cada comentario que dispare una regla, con lo que pasó con su mensaje.
        </p>
      ) : (
        <ul className="admin-sheet divide-y divide-[var(--admin-line)]">
          {events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">
                  <span className="font-medium">@{event.username || "alguien"}</span>{" "}
                  <span className="text-[var(--admin-muted)]">comentó</span> «{event.text}»
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--admin-muted)]">
                  {event.automationName} · {formatWhen(event.at)}
                  {event.publicReply === "sent" ? " · respondido en público" : ""}
                  {event.status === "failed" && event.error ? ` · ${event.error}` : ""}
                  {event.status === "deferred" ? " · sale solo cuando haya cupo" : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${EVENT_TONE[event.status]}`}>
                {EVENT_LABEL[event.status]}
              </span>
              {event.permalink ? (
                <a
                  href={event.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-[12px] text-[var(--admin-muted)] underline"
                >
                  Ver post
                </a>
              ) : null}
              {event.status === "failed" || event.status === "deferred" ? (
                <button
                  type="button"
                  disabled={busy === event.id}
                  onClick={() => void retry(event)}
                  className="h-8 shrink-0 rounded-full bg-[var(--admin-field)] px-3 text-[12px] disabled:opacity-40"
                >
                  {busy === event.id ? "Enviando…" : "Reintentar"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <AutomationEditor
          key={editing.id || editing.title}
          title={editing.title}
          initial={editing.initial}
          connected={status.ready}
          busy={busy === "save"}
          error={editorError}
          loadMedia={loadMedia}
          onSave={(input) => void save(input)}
          onClose={closeEditor}
        />
      ) : null}

      {toast ? (
        <p className="pointer-events-none fixed bottom-[calc(var(--admin-dock)+1rem)] left-1/2 z-[70] -translate-x-1/2 rounded-full bg-[#1d1d1f] px-4 py-2 text-[12px] text-white shadow-lg lg:bottom-6">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

function Heading() {
  return (
    <header>
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Alcance</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">Automatizaciones.</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
        Alguien comenta una palabra en Instagram y Mora le escribe por mensaje directo. Si responde, el chat entra
        al CRM para que un vendedor lo cierre.
      </p>
    </header>
  );
}

function Kpi({ label, value, hint, alert }: { label: string; value: string; hint: string; alert?: boolean }) {
  return (
    <div className={`ventas-kpi ${alert ? "is-alert" : ""}`}>
      <p className="text-[11px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">{hint}</p>
    </div>
  );
}
