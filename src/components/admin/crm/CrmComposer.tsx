"use client";

import { useMemo, useState } from "react";
import type { CrmDesk, CrmSettings } from "@/growth/types";
import { formatClock } from "@/crm/labels";

export function CrmComposer({
  desk,
  settings,
  windowOpen,
  windowClosesAt,
  error,
  onSend,
  onTemplate,
}: {
  desk: CrmDesk;
  settings: CrmSettings | null;
  windowOpen: boolean;
  windowClosesAt: number | null;
  error: string;
  onSend: (text: string) => void | Promise<void>;
  onTemplate: (id: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const replies = useMemo(
    () =>
      (settings?.replies ?? []).filter((item) => item.desk === desk || item.desk === "both"),
    [desk, settings?.replies],
  );
  const templates = useMemo(
    () =>
      (settings?.templates ?? []).filter((item) => item.desk === desk || item.desk === "both"),
    [desk, settings?.templates],
  );

  async function submit() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      await onSend(draft.trim());
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-white/8 p-4">
      {!windowOpen ? (
        <p className="mb-3 text-[12px] leading-5 text-white/45">
          La ventana de 24 h está cerrada. WhatsApp solo acepta una plantilla aprobada.
          {templates.length === 0
            ? " Añádelas en Ajustes cuando Meta las apruebe."
            : ""}
        </p>
      ) : windowClosesAt ? (
        <p className="mb-3 text-[12px] text-white/35">
          Puedes escribir libre hasta las {formatClock(windowClosesAt)}.
        </p>
      ) : null}

      {replies.length > 0 ? (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {replies.map((reply) => (
            <button
              key={reply.id}
              type="button"
              onClick={() => setDraft(reply.body)}
              className="shrink-0 rounded-full bg-white/8 px-3 py-1.5 text-[11px] text-white/60"
            >
              {reply.title}
            </button>
          ))}
        </div>
      ) : null}

      {!windowOpen && templates.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              disabled={busy}
              onClick={() => void onTemplate(template.id)}
              className="rounded-full bg-[#1d1d1f] px-3 py-1.5 text-[11px] text-white disabled:opacity-40"
            >
              {template.label}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={windowOpen ? "Escribe. Enter envía." : "Ventana cerrada. Usa una plantilla."}
          disabled={!windowOpen}
          className="h-11 flex-1 rounded-full bg-white/8 px-4 text-[13px] outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim() || !windowOpen}
          className="h-11 rounded-full bg-white px-5 text-[13px] text-[#12111a] disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
      {error ? <p className="mt-2 text-[12px] text-red-300">{error}</p> : null}
    </div>
  );
}
