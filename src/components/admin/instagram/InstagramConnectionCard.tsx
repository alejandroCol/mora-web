"use client";

import { useState } from "react";
import Link from "next/link";
import { formatWhen } from "@/crm/labels";
import { INSTAGRAM_WEBHOOK_FIELDS, type InstagramConnectionStatus } from "@/instagram/types";

/**
 * Estado de la conexión con Instagram. Sin conectar pide lo único que hace
 * falta: un token. Conectado, dice si Meta está avisando o por qué no.
 */
export function InstagramConnectionCard({
  status,
  busy,
  registering,
  onConnect,
  onDisconnect,
  onHumanAgent,
  onRegisterWebhook,
}: {
  status: InstagramConnectionStatus;
  busy: boolean;
  registering: boolean;
  onConnect: (token: string) => Promise<boolean>;
  onDisconnect: () => void;
  onHumanAgent: (enabled: boolean) => void;
  onRegisterWebhook: () => void;
}) {
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [changing, setChanging] = useState(false);

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(status.webhook);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Sin permiso de portapapeles: la URL queda a la vista para copiarla a mano.
    }
  }

  const missingKeys = !status.hasAppSecret || !status.hasVerifyToken;
  const registered = status.ready && status.debug.registeredAt > 0;
  const missingFields = INSTAGRAM_WEBHOOK_FIELDS.filter(
    (field) => !status.debug.registeredFields.includes(field),
  );
  const form = (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!token.trim()) return;
        void onConnect(token.trim()).then((ok) => {
          if (ok) {
            setToken("");
            setChanging(false);
          }
        });
      }}
    >
      <input
        value={token}
        onChange={(event) => setToken(event.target.value)}
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="Token del usuario del sistema"
        className="h-10 min-w-0 flex-1 rounded-full bg-[var(--admin-field)] px-4 text-[13px] outline-none"
      />
      <button
        type="submit"
        disabled={busy || token.trim().length < 40}
        className="admin-cta auto-cta disabled:opacity-40"
      >
        {busy ? "Conectando…" : "Conectar"}
      </button>
    </form>
  );

  return (
    <section className="admin-sheet px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium">
            {status.ready ? `Instagram conectado · @${status.username}` : "Conecta Instagram"}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
            {status.ready
              ? `Página ${status.pageName || "de Facebook"} · desde ${formatWhen(status.connectedAt)}`
              : "Un token y listo: Mora encuentra la cuenta y se suscribe a comentarios y mensajes."}
          </p>
        </div>
        {status.ready ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setChanging((open) => !open)}
              className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px]"
            >
              {changing ? "Cancelar" : "Cambiar token"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("¿Desconectar Instagram? Las reglas se conservan pero dejan de responder.")) {
                  onDisconnect();
                }
              }}
              className="h-9 rounded-full px-4 text-[12px] text-[var(--admin-danger)] hover:bg-red-50 disabled:opacity-40"
            >
              Desconectar
            </button>
          </div>
        ) : null}
      </div>

      {missingKeys ? (
        <p className="auto-alert is-danger">
          {!status.hasAppSecret
            ? "Falta el App secret. Sin él no se puede comprobar que un aviso viene de Meta y se rechazan todos."
            : "Falta el verify token: Meta no podrá validar el webhook."}{" "}
          <Link href="/superadmin/campanas" className="underline">
            Pégalo en Campañas
          </Link>
          .
        </p>
      ) : null}

      {status.ready ? <Health status={status} /> : null}
      {!status.ready || changing ? form : null}

      <div className="auto-webhook">
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--admin-muted)]">
            {registered
              ? `Webhook registrado en Meta ${formatWhen(status.debug.registeredAt)}`
              : status.ready
                ? "Webhook aún sin registrar en Meta"
                : "Webhook de Instagram: se registra solo al conectar"}
          </p>
          <p className="mt-0.5 truncate font-mono text-[12px]">{status.webhook}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {status.ready ? (
            <button
              type="button"
              disabled={registering || missingKeys}
              onClick={onRegisterWebhook}
              className="h-8 rounded-full bg-white px-3 text-[12px] shadow-[var(--admin-shadow)] disabled:opacity-40"
            >
              {registering ? "Registrando…" : registered ? "Registrar de nuevo" : "Registrar en Meta"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void copyWebhook()}
            className="h-8 rounded-full bg-white px-3 text-[12px] shadow-[var(--admin-shadow)]"
          >
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>
      {registered && missingFields.length > 0 ? (
        <p className="auto-alert is-danger">
          Meta no dejó suscribir {missingFields.join(", ")}. Lo que dependa de esos avisos no llega.
        </p>
      ) : null}

      {status.ready ? (
        <label className="mt-3 flex items-start gap-3 text-[13px]">
          <input
            type="checkbox"
            checked={status.humanAgent}
            disabled={busy}
            onChange={(event) => onHumanAgent(event.target.checked)}
            className="mt-1"
          />
          <span>
            Meta ya me aprobó «Human Agent»
            <span className="block text-[12px] text-[var(--admin-muted)]">
              El equipo puede responder un DM hasta 7 días después, no solo 24 h. Actívalo solo con el permiso
              aprobado: sin él, esos envíos fallan.
            </span>
          </span>
        </label>
      ) : null}
    </section>
  );
}

/** ¿Meta está avisando? Lo primero que hay que mirar cuando «no responde». */
function Health({ status }: { status: InstagramConnectionStatus }) {
  const { debug } = status;
  if (debug.lastRejectedAt > debug.lastPostAt) {
    return (
      <p className="auto-alert is-danger">
        Meta mandó un aviso {formatWhen(debug.lastRejectedAt)} y se rechazó. {debug.lastRejectReason}
      </p>
    );
  }
  if (!debug.lastPostAt) {
    return (
      <p className="auto-alert">
        Meta aún no ha mandado ningún aviso. Comenta en una publicación con una cuenta que tenga rol en la app de
        Meta: si aquí no cambia nada, pulsa «Registrar en Meta» abajo.
      </p>
    );
  }
  return (
    <>
      <p className="auto-alert is-ok">
        Último aviso de Meta {formatWhen(debug.lastPostAt)} · {debug.lastComments}{" "}
        {debug.lastComments === 1 ? "comentario" : "comentarios"} · {debug.lastMessages}{" "}
        {debug.lastMessages === 1 ? "mensaje" : "mensajes"}
      </p>
      {debug.lastError ? <p className="auto-alert is-danger">Ese aviso tuvo un problema: {debug.lastError}</p> : null}
    </>
  );
}
