"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CrmDesk, CrmSettings } from "@/growth/types";
import { formatClock } from "@/crm/labels";
import { formatMoney, products } from "@/lib/catalog";

const SELLS = [
  { id: "pro", label: "Pro", text: `Mora Pro ${formatMoney(products.aero.price)} → https://moraring.com/anillo/pro` },
  { id: "ultra", label: "Ultra", text: `Mora Ultra ${formatMoney(products.titan.price)} → https://moraring.com/anillo/ultra` },
  { id: "talla", label: "Talla", text: "Te mandamos el medidor o te mides aquí: https://moraring.com/talla" },
  { id: "pago", label: "Pagar", text: "Para apartarlo: https://moraring.com/checkout" },
];

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
  const area = useRef<HTMLTextAreaElement>(null);

  function grow(el: HTMLTextAreaElement) {
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }

  useEffect(() => {
    if (area.current) grow(area.current);
  }, [draft]);

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
      if (area.current) area.current.style.height = "";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-composer">
      {!windowOpen ? (
        <p className="crm-composer-note">
          Ventana cerrada. Solo plantilla Meta.
          {templates.length === 0 ? " Añádelas en Ajustes." : ""}
        </p>
      ) : windowClosesAt ? (
        <p className="crm-composer-note">Libre hasta las {formatClock(windowClosesAt)}</p>
      ) : null}

      <div className="crm-composer-chips">
        {SELLS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setDraft((current) => (current ? `${current}\n${item.text}` : item.text))}
            className="crm-sell"
          >
            {item.label}
          </button>
        ))}
        {replies.map((reply) => (
          <button
            key={reply.id}
            type="button"
            onClick={() => setDraft(reply.body)}
            className="crm-quick"
          >
            {reply.title}
          </button>
        ))}
      </div>

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
        className="crm-composer-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="crm-composer-field">
          <textarea
            ref={area}
            value={draft}
            rows={1}
            enterKeyHint="enter"
            onChange={(event) => {
              setDraft(event.target.value);
              grow(event.target);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && window.matchMedia("(min-width: 1024px)").matches) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={windowOpen ? "Mensaje" : "Ventana cerrada. Usa una plantilla."}
            disabled={!windowOpen}
            className="crm-composer-input"
          />
          {draft ? (
            <button
              type="button"
              onClick={() => setDraft("")}
              aria-label="Borrar texto"
              className="crm-composer-clear"
            >
              ×
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={busy || !draft.trim() || !windowOpen}
          className="crm-send"
          aria-label="Enviar"
        >
          <SendGlyph />
        </button>
      </form>
      {error ? <p className="mt-2 text-[12px] text-red-300">{error}</p> : null}
    </div>
  );
}

function SendGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M3.2 11.15 19.7 3.7c.85-.38 1.68.46 1.3 1.31l-7.45 16.5c-.4.88-1.66.76-1.88-.18L10.2 14.8 3.38 13.03c-.94-.22-1.06-1.5-.18-1.88Z" />
    </svg>
  );
}
