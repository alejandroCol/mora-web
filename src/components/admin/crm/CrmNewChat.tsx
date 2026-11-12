"use client";

import { useState } from "react";
import { DESK_LABEL } from "@/crm/labels";
import type { CrmDesk, CrmTemplate } from "@/growth/types";

/** Tarifa de Meta por plantilla entregada a un número de Colombia (oct. 2026), en pesos redondeados. */
const COST_COP: Record<NonNullable<CrmTemplate["billingCategory"]>, number> = {
  marketing: 46,
  utility: 3,
  authentication: 3,
};

function fill(body: string, first: string) {
  return body.replace(/\{\{\d+\}\}/g, first || "{nombre}");
}

/** Celular colombiano de 10 dígitos o número con indicativo. */
function phoneLooksValid(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 ? digits.startsWith("3") : digits.length >= 11 && digits.length <= 15;
}

export function CrmNewChat({
  templates,
  desk,
  initial,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  templates: CrmTemplate[];
  desk: CrmDesk;
  initial: { phone: string; name: string };
  busy: boolean;
  error: string;
  onSubmit: (input: { phone: string; name: string; templateId: string }) => void;
  onClose: () => void;
}) {
  const options = templates.filter((item) => item.desk === desk || item.desk === "both");
  const [phone, setPhone] = useState(initial.phone);
  const [name, setName] = useState(initial.name);
  const [templateId, setTemplateId] = useState(options[0]?.id ?? "");

  const template = options.find((item) => item.id === templateId);
  const first = name.trim().split(/\s+/)[0] ?? "";
  const ready = phoneLooksValid(phone) && name.trim() !== "" && Boolean(template);
  const cost = COST_COP[template?.billingCategory ?? "marketing"];

  return (
    <div className="crm-sheet" onClick={onClose}>
      <form
        className="crm-sheet-card crm-newchat"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !busy) onSubmit({ phone, name, templateId });
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] text-[var(--admin-muted)]">WhatsApp</p>
            <h2 className="mt-1 font-display text-3xl tracking-[-0.04em]">Nuevo chat.</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[13px] text-[var(--admin-muted)]">
            Cerrar
          </button>
        </div>
        <p className="mt-2 max-w-md text-[13px] leading-6 text-[var(--admin-muted)]">
          WhatsApp solo deja escribir primero con una plantilla aprobada. Cuando responda, sigues el chat normal.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="crm-newchat-field">
            <span>Nombre</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              placeholder="Ana Gómez"
              autoFocus={!initial.name}
            />
          </label>
          <label className="crm-newchat-field">
            <span>Celular</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="off"
              placeholder="300 123 4567"
            />
            <small>Sin indicativo se asume Colombia (+57).</small>
          </label>
        </div>

        <p className="mt-5 text-[12px] text-[var(--admin-muted)]">Primer mensaje</p>
        {options.length === 0 ? (
          <p className="auto-alert">
            Aún no hay plantillas aprobadas para {DESK_LABEL[desk]}. Se crean en WhatsApp
            Manager y se registran en Ajustes.
          </p>
        ) : (
          <div className="mt-2 grid gap-2">
            {options.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTemplateId(item.id)}
                className={`crm-newchat-template ${item.id === templateId ? "is-on" : ""}`}
              >
                <span className="text-[12px] font-medium">{item.label}</span>
                <span className="mt-1 block text-[13px] leading-5">
                  {item.body ? fill(item.body, first) : `Plantilla ${item.name}`}
                </span>
              </button>
            ))}
          </div>
        )}

        {error ? <p className="auto-alert is-danger">{error}</p> : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--admin-muted)]">
            {template ? `Meta cobra ~COP ${cost} por esta plantilla.` : ""}
          </p>
          <button type="submit" disabled={!ready || busy} className="admin-cta auto-cta disabled:opacity-40">
            {busy ? "Enviando…" : "Enviar y abrir chat"}
          </button>
        </div>
      </form>
    </div>
  );
}
