"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CrmDesk, CrmSettings } from "@/growth/types";
import { formatClock } from "@/crm/labels";
import { PAYMENT_CHIP_TEXT } from "@/crm/replies";
import { formatMoney, products } from "@/lib/catalog";

/** Se arma al pintar: el precio vivo puede cambiar desde Inventario. */
function sells() {
  return [
    { id: "pro", label: "Pro", text: `Mora Pro ${formatMoney(products.aero.price)} → https://moraring.com/anillo/pro` },
    { id: "ultra", label: "Ultra", text: `Mora Ultra ${formatMoney(products.titan.price)} → https://moraring.com/anillo/ultra` },
    { id: "talla", label: "Talla", text: "Te mandamos el medidor o te mides aquí: https://moraring.com/talla" },
    { id: "pago", label: "Pagar", text: PAYMENT_CHIP_TEXT },
  ];
}

const IMAGE_TYPES = ["image/jpeg", "image/png"];
const IMAGE_MAX = 5 * 1024 * 1024;

const EMOJI_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Caras",
    items: ["😊", "😁", "😄", "🙂", "😉", "😍", "🥰", "😘", "🤩", "😎", "🤗", "🤭", "😅", "😂", "🤣", "🥹", "😌", "🙏", "🤔", "😴", "😢", "😮", "🙈", "🫶"],
  },
  {
    label: "Gestos",
    items: ["👋", "👍", "👌", "🤝", "👏", "🙌", "💪", "✌️", "🤞", "👉", "👈", "☝️", "💅", "🫰"],
  },
  {
    label: "Mora",
    items: ["💍", "💜", "🟣", "✨", "⭐", "🌙", "😴", "🫀", "❤️", "🩵", "🧘", "🏃", "💧", "🔋", "📱", "📦", "🚚", "🎁", "💳", "🏦", "🧾", "✅", "⏰", "📍", "🎉", "🔥", "💯", "🙌"],
  },
];

type Attachment = { file: File; url: string };

export function CrmComposer({
  desk,
  settings,
  windowOpen,
  windowClosesAt,
  error,
  onSend,
  onSendImage,
  onTemplate,
}: {
  desk: CrmDesk;
  settings: CrmSettings | null;
  windowOpen: boolean;
  windowClosesAt: number | null;
  error: string;
  /** Devuelve `false` si no salió: el borrador se conserva para reintentar. */
  onSend: (text: string) => boolean | void | Promise<boolean | void>;
  onSendImage: (file: File, caption: string) => boolean | void | Promise<boolean | void>;
  onTemplate: (id: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachError, setAttachError] = useState("");
  const [dragging, setDragging] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const emojiBox = useRef<HTMLDivElement>(null);

  function grow(el: HTMLTextAreaElement) {
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }

  useEffect(() => {
    if (area.current) grow(area.current);
  }, [draft]);

  // Libera la URL del preview cuando cambia o se desmonta.
  useEffect(() => {
    const url = attachment?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment]);

  // Cierra el selector de emojis al tocar fuera o con Esc.
  useEffect(() => {
    if (!emojiOpen) return;
    function onDown(event: PointerEvent) {
      if (!emojiBox.current?.contains(event.target as Node)) setEmojiOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setEmojiOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

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

  function pickFile(file: File | null | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setAttachError("Solo JPG o PNG.");
      return;
    }
    if (file.size > IMAGE_MAX) {
      setAttachError("La imagen pesa más de 5 MB.");
      return;
    }
    setAttachError("");
    setAttachment({ file, url: URL.createObjectURL(file) });
    area.current?.focus();
  }

  function insertEmoji(emoji: string) {
    const el = area.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = start + emoji.length;
      el.setSelectionRange(caret, caret);
    });
  }

  const canSend = windowOpen && !busy && (Boolean(attachment) || Boolean(draft.trim()));

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    try {
      const ok = attachment
        ? await onSendImage(attachment.file, draft.trim())
        : await onSend(draft.trim());
      if (ok === false) return;
      setAttachment(null);
      setDraft("");
      setEmojiOpen(false);
      if (area.current) area.current.style.height = "";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`crm-composer ${dragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        if (!windowOpen) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!windowOpen) return;
        pickFile(event.dataTransfer.files?.[0]);
      }}
    >
      {!windowOpen ? (
        <p className="crm-composer-note">
          Ventana cerrada. Solo plantilla Meta.
          {templates.length === 0 ? " Añádelas en Ajustes." : ""}
        </p>
      ) : windowClosesAt ? (
        <p className="crm-composer-note">Libre hasta las {formatClock(windowClosesAt)}</p>
      ) : null}

      <div className="crm-composer-chips">
        {sells().map((item) => (
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
              title={template.body || template.name}
              onClick={() => void onTemplate(template.id)}
              className="rounded-full bg-[#1d1d1f] px-3 py-1.5 text-[11px] text-white disabled:opacity-40"
            >
              {template.label}
            </button>
          ))}
        </div>
      ) : null}

      {attachment ? (
        <div className="crm-attachment">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.url} alt="" className="crm-attachment-thumb" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] text-[#1d1d1f]">{attachment.file.name}</p>
            <p className="text-[11px] text-[#86868b]">
              {(attachment.file.size / 1024 / 1024).toFixed(1)} MB · el texto va como pie de foto
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Quitar imagen"
            className="crm-attachment-remove"
          >
            ×
          </button>
        </div>
      ) : null}

      <form
        className="crm-composer-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          ref={picker}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(event) => {
            pickFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={!windowOpen || busy}
          aria-label="Adjuntar imagen"
          title="Adjuntar imagen (JPG o PNG)"
          className="crm-composer-tool"
        >
          <ClipGlyph />
        </button>

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
            onPaste={(event) => {
              const file = Array.from(event.clipboardData.files ?? []).find((item) =>
                item.type.startsWith("image/"),
              );
              if (file && windowOpen) {
                event.preventDefault();
                pickFile(file);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && window.matchMedia("(min-width: 1024px)").matches) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={
              !windowOpen ? "Ventana cerrada. Usa una plantilla." : attachment ? "Pie de foto (opcional)" : "Mensaje"
            }
            disabled={!windowOpen}
            className="crm-composer-input"
          />
          <div className="crm-composer-inline" ref={emojiBox}>
            <button
              type="button"
              onClick={() => setEmojiOpen((open) => !open)}
              disabled={!windowOpen}
              aria-label="Emojis"
              aria-expanded={emojiOpen}
              className={`crm-composer-emoji ${emojiOpen ? "is-on" : ""}`}
            >
              <SmileGlyph />
            </button>
            {emojiOpen ? (
              <div className="crm-emoji-pop" role="dialog" aria-label="Elegir emoji">
                {EMOJI_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="crm-emoji-label">{group.label}</p>
                    <div className="crm-emoji-grid">
                      {group.items.map((emoji) => (
                        <button
                          key={`${group.label}-${emoji}`}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          className="crm-emoji"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {draft && !emojiOpen ? (
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
        <button type="submit" disabled={!canSend} className="crm-send" aria-label="Enviar">
          <SendGlyph />
        </button>
      </form>
      {attachError || error ? (
        <p className="mt-2 text-[12px] text-red-300">{attachError || error}</p>
      ) : null}
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

function ClipGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path
        d="M20.3 11.6 12.6 19.3a5 5 0 0 1-7.1-7.1l8.2-8.2a3.3 3.3 0 0 1 4.7 4.7l-8.2 8.2a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SmileGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.2a4.3 4.3 0 0 0 7 0" strokeLinecap="round" />
      <circle cx="9.3" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="10" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
