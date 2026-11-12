"use client";

import { useEffect, useState, type ReactNode } from "react";
import { quickSells } from "@/crm/sells";
import { matchesKeyword, normalizeText } from "@/instagram/match";
import {
  AUTOMATION_LIMITS,
  type InstagramAutomationInput,
  type InstagramMediaItem,
  type InstagramMediaRef,
} from "@/instagram/types";

const KEYWORD_IDEAS = ["INFO", "PRECIO", "QUIERO", "PRO", "ULTRA"];

const PUBLIC_REPLY_IDEAS = [
  "¡Listo! Te escribí por mensaje directo 💜",
  "Revisa tus mensajes, ahí te lo dejé ✨",
  "Ya te lo mandé por interno 🙌",
];

/** `null` mientras se leen las publicaciones. */
type MediaState = { items: InstagramMediaItem[] } | { error: string } | null;

/**
 * Editor de una regla, en el orden en que se piensa: dónde, qué comentan,
 * qué les llega. A la derecha se ve el mensaje tal como lo recibe la persona.
 */
export function AutomationEditor({
  title,
  initial,
  connected,
  busy,
  error,
  loadMedia,
  onSave,
  onClose,
}: {
  title: string;
  initial: InstagramAutomationInput;
  /** Sin conexión no hay publicaciones para elegir. */
  connected: boolean;
  busy: boolean;
  error: string;
  loadMedia: () => Promise<InstagramMediaItem[]>;
  onSave: (input: InstagramAutomationInput) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState("");
  const [withButton, setWithButton] = useState(Boolean(initial.dmButtonUrl));
  const [media, setMedia] = useState<MediaState>(null);
  const [attempt, setAttempt] = useState(0);
  const [sample, setSample] = useState("");
  const [dirty, setDirty] = useState(false);

  function change(patch: Partial<InstagramAutomationInput>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function close() {
    if (dirty && !window.confirm("¿Salir sin guardar la regla?")) return;
    onClose();
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (dirty && !window.confirm("¿Salir sin guardar la regla?")) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dirty, onClose]);

  // Las publicaciones se piden a Meta solo cuando hacen falta.
  const needsMedia = draft.scope === "media" && connected;
  useEffect(() => {
    if (!needsMedia) return;
    let cancelled = false;
    loadMedia()
      .then((items) => {
        if (!cancelled) setMedia({ items });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setMedia({ error: cause instanceof Error ? cause.message : "No se pudieron leer las publicaciones." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, loadMedia, needsMedia]);

  function addKeyword(raw: string) {
    const words = raw
      .split(",")
      .map((item) => item.trim().slice(0, AUTOMATION_LIMITS.keyword))
      .filter(Boolean);
    if (words.length === 0) return;
    const known = new Set(draft.keywords.map((item) => normalizeText(item) || item));
    const next = [...draft.keywords];
    for (const word of words) {
      const key = normalizeText(word) || word;
      if (known.has(key) || next.length >= AUTOMATION_LIMITS.keywords) continue;
      known.add(key);
      next.push(word);
    }
    change({ keywords: next });
    setPending("");
  }

  function toggleMedia(item: InstagramMediaRef) {
    const chosen = draft.media.some((entry) => entry.id === item.id);
    if (!chosen && draft.media.length >= AUTOMATION_LIMITS.media) return;
    change({
      media: chosen
        ? draft.media.filter((entry) => entry.id !== item.id)
        : [...draft.media, { id: item.id, permalink: item.permalink, caption: item.caption }],
    });
  }

  // La palabra a medio escribir también cuenta: nadie debería perderla por no pulsar Enter.
  const keywords = pending.trim() ? [...draft.keywords, pending.trim()] : draft.keywords;
  const limit = withButton ? AUTOMATION_LIMITS.dmTextWithButton : AUTOMATION_LIMITS.dmText;
  const over = draft.dmText.trim().length > limit;
  const fires =
    sample.trim() === ""
      ? null
      : draft.trigger === "any" || keywords.some((keyword) => matchesKeyword(sample, keyword));

  const problem =
    draft.scope === "media" && draft.media.length === 0
      ? "Elige al menos una publicación."
      : draft.trigger === "keywords" && keywords.length === 0
        ? "Agrega al menos una palabra."
        : !draft.dmText.trim()
          ? "Escribe el mensaje que llega por DM."
          : over
            ? `El mensaje admite hasta ${limit} caracteres${withButton ? " cuando lleva botón" : ""}.`
            : withButton && (!draft.dmButtonLabel.trim() || !draft.dmButtonUrl.trim())
              ? "El botón necesita texto y enlace."
              : "";

  function submit() {
    if (problem || busy) return;
    onSave({
      ...draft,
      keywords,
      dmButtonLabel: withButton ? draft.dmButtonLabel.trim() : "",
      dmButtonUrl: withButton ? draft.dmButtonUrl.trim() : "",
      publicReplies: draft.publicReplies.map((item) => item.trim()).filter(Boolean),
    });
  }

  const recent = media && "items" in media ? media.items : [];
  // Publicaciones ya elegidas que no salen entre las recientes: se siguen viendo para poder quitarlas.
  const older = draft.media.filter((item) => !recent.some((entry) => entry.id === item.id));
  const publicReply = draft.publicReplies.find((item) => item.trim());

  return (
    <div className="auto-editor" role="dialog" aria-modal="true" aria-label={title}>
      <div className="auto-editor-card">
        <header className="auto-editor-head">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--admin-muted)]">Regla</p>
            <h2 className="font-display text-2xl tracking-[-0.04em]">{title}</h2>
          </div>
          <button type="button" onClick={close} className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[13px]">
            Cerrar
          </button>
        </header>

        <div className="auto-editor-body">
          <div className="auto-editor-form">
            <Step number={1} title="¿En qué publicaciones?">
              <Segmented
                value={draft.scope}
                options={[
                  { id: "all", label: "En todas" },
                  { id: "media", label: "Elegir publicaciones" },
                ]}
                onChange={(scope) => change({ scope })}
              />
              {draft.scope === "media" ? (
                <div className="mt-3">
                  {!connected ? (
                    <p className="text-[12px] text-[var(--admin-muted)]">
                      Conecta Instagram para ver tus publicaciones.
                    </p>
                  ) : media === null ? (
                    <p className="text-[12px] text-[var(--admin-muted)]">Leyendo tus publicaciones…</p>
                  ) : "error" in media ? (
                    <p className="text-[12px] text-[var(--admin-danger)]">
                      {media.error}{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          setMedia(null);
                          setAttempt((count) => count + 1);
                        }}
                      >
                        Reintentar
                      </button>
                    </p>
                  ) : recent.length === 0 ? (
                    <p className="text-[12px] text-[var(--admin-muted)]">La cuenta aún no tiene publicaciones.</p>
                  ) : (
                    <div className="auto-media-grid">
                      {recent.map((item) => (
                        <MediaTile
                          key={item.id}
                          item={item}
                          on={draft.media.some((entry) => entry.id === item.id)}
                          onToggle={() => toggleMedia(item)}
                        />
                      ))}
                    </div>
                  )}
                  {older.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {older.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleMedia(item)}
                          className="auto-chip"
                          title="Quitar"
                        >
                          {item.caption ? item.caption.slice(0, 32) : "Publicación anterior"} ×
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 text-[11px] text-[var(--admin-muted)]">
                    {draft.media.length === 0
                      ? "Toca las publicaciones donde aplica."
                      : `${draft.media.length} ${draft.media.length === 1 ? "elegida" : "elegidas"}.`}{" "}
                    Una regla con publicación gana sobre una general.
                  </p>
                </div>
              ) : null}
            </Step>

            <Step number={2} title="¿Qué deben comentar?">
              <Segmented
                value={draft.trigger}
                options={[
                  { id: "keywords", label: "Una palabra" },
                  { id: "any", label: "Cualquier comentario" },
                ]}
                onChange={(trigger) => change({ trigger })}
              />
              {draft.trigger === "keywords" ? (
                <>
                  <div className="auto-keywords">
                    {draft.keywords.map((keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => change({ keywords: draft.keywords.filter((item) => item !== keyword) })}
                        className="auto-chip is-on"
                        title="Quitar"
                      >
                        {keyword} ×
                      </button>
                    ))}
                    <input
                      value={pending}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value.includes(",")) addKeyword(value);
                        else setPending(value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addKeyword(pending);
                        } else if (event.key === "Backspace" && !pending && draft.keywords.length > 0) {
                          change({ keywords: draft.keywords.slice(0, -1) });
                        }
                      }}
                      onBlur={() => addKeyword(pending)}
                      maxLength={AUTOMATION_LIMITS.keyword}
                      placeholder={draft.keywords.length === 0 ? "Escribe una palabra y pulsa Enter" : "Otra…"}
                      className="auto-keyword-input"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {KEYWORD_IDEAS.filter(
                      (idea) => !draft.keywords.some((item) => normalizeText(item) === normalizeText(idea)),
                    ).map((idea) => (
                      <button key={idea} type="button" onClick={() => addKeyword(idea)} className="auto-chip">
                        + {idea}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--admin-muted)]">
                    No importan mayúsculas, tildes ni signos. Debe ir la palabra completa: «info» no responde a
                    «información».
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
                  Todo el que comente recibe el mensaje. Mejor con publicaciones elegidas.
                </p>
              )}
            </Step>

            <Step number={3} title="El mensaje que le llega">
              <textarea
                value={draft.dmText}
                onChange={(event) => change({ dmText: event.target.value })}
                rows={5}
                placeholder="¡Hola! Aquí tienes lo que pediste…"
                className="auto-textarea"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {quickSells()
                  .filter((item) => item.id !== "pago")
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        change({ dmText: draft.dmText.trim() ? `${draft.dmText.trimEnd()}\n${item.text}` : item.text })
                      }
                      className="auto-chip"
                    >
                      + {item.label}
                    </button>
                  ))}
                <span className={`ml-auto text-[11px] ${over ? "text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>
                  {draft.dmText.trim().length} / {limit}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-[var(--admin-muted)]">
                Instagram deja mandar un solo mensaje por comentario: pon aquí todo. Si la persona responde, el chat
                entra al CRM.
              </p>

              <label className="mt-3 flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={withButton}
                  onChange={(event) => {
                    setWithButton(event.target.checked);
                    setDirty(true);
                  }}
                />
                Añadir un botón con enlace
              </label>
              {withButton ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr]">
                  <input
                    value={draft.dmButtonLabel}
                    onChange={(event) => change({ dmButtonLabel: event.target.value })}
                    maxLength={AUTOMATION_LIMITS.buttonLabel}
                    placeholder="Ver el anillo"
                    className="auto-input"
                  />
                  <input
                    value={draft.dmButtonUrl}
                    onChange={(event) => change({ dmButtonUrl: event.target.value })}
                    inputMode="url"
                    placeholder="https://moraring.com/anillo/ultra"
                    className="auto-input"
                  />
                </div>
              ) : null}
            </Step>

            <Step number={4} title="Respuesta en el comentario" optional>
              <div className="space-y-2">
                {draft.publicReplies.map((reply, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      value={reply}
                      onChange={(event) =>
                        change({
                          publicReplies: draft.publicReplies.map((item, i) => (i === index ? event.target.value : item)),
                        })
                      }
                      maxLength={AUTOMATION_LIMITS.publicReply}
                      placeholder="Te escribí por DM"
                      className="auto-input"
                    />
                    <button
                      type="button"
                      onClick={() => change({ publicReplies: draft.publicReplies.filter((_, i) => i !== index) })}
                      className="text-[12px] text-[var(--admin-muted)]"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {draft.publicReplies.length < AUTOMATION_LIMITS.publicReplies ? (
                  <button
                    type="button"
                    onClick={() => change({ publicReplies: [...draft.publicReplies, ""] })}
                    className="auto-chip"
                  >
                    + Añadir respuesta
                  </button>
                ) : null}
                {draft.publicReplies.length === 0 ? (
                  <button type="button" onClick={() => change({ publicReplies: PUBLIC_REPLY_IDEAS })} className="auto-chip">
                    Usar 3 sugeridas
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] text-[var(--admin-muted)]">
                Se responde en público con una al azar, para que no parezca robot. Vacío = solo el DM.
              </p>
            </Step>

            <Step number={5} title="Detalles" optional>
              <label className="flex items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={draft.oncePerPerson}
                  onChange={(event) => change({ oncePerPerson: event.target.checked })}
                  className="mt-1"
                />
                <span>
                  Una sola vez por persona
                  <span className="block text-[12px] text-[var(--admin-muted)]">
                    Si vuelve a comentar, no se le repite el mensaje.
                  </span>
                </span>
              </label>
              <input
                value={draft.name}
                onChange={(event) => change({ name: event.target.value })}
                maxLength={AUTOMATION_LIMITS.name}
                placeholder="Nombre de la regla (si lo dejas vacío, usa la palabra)"
                className="auto-input mt-3"
              />
            </Step>
          </div>

          <aside className="auto-preview">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--admin-muted)]">Así lo recibe</p>
            <div className="auto-phone">
              <p className="auto-phone-label">Mensaje directo</p>
              <div className="auto-dm">
                <p className="whitespace-pre-wrap break-words">
                  {draft.dmText.trim() || "Aquí aparece tu mensaje."}
                </p>
                {withButton && draft.dmButtonLabel.trim() ? (
                  <span className="auto-dm-button">{draft.dmButtonLabel.trim()}</span>
                ) : null}
              </div>
              {publicReply ? (
                <>
                  <p className="auto-phone-label mt-4">En el comentario</p>
                  <p className="auto-public">
                    <strong>moraringco</strong> {publicReply}
                  </p>
                </>
              ) : null}
            </div>

            <label className="mt-4 block">
              <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                Prueba un comentario
              </span>
              <input
                value={sample}
                onChange={(event) => setSample(event.target.value)}
                placeholder="quiero info porfa!!"
                className="auto-input mt-1.5"
              />
            </label>
            {fires === null ? null : (
              <p className={`mt-2 text-[12px] ${fires ? "text-[var(--admin-ok)]" : "text-[var(--admin-muted)]"}`}>
                {fires ? "Sí: con ese comentario se envía el mensaje." : "No: ese comentario no dispara esta regla."}
              </p>
            )}
          </aside>
        </div>

        <footer className="auto-editor-foot">
          <p className={`min-w-0 text-[12px] ${error ? "text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>
            {error || problem || (draft.active ? "Al guardar queda activa." : "Queda en pausa hasta que la actives.")}
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={close} className="h-10 rounded-full bg-[var(--admin-field)] px-4 text-[13px]">
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy || Boolean(problem)}
              onClick={submit}
              className="admin-cta auto-cta disabled:opacity-40"
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  optional,
  children,
}: {
  number: number;
  title: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="auto-step">
      <p className="auto-step-title">
        <span className="auto-step-number">{number}</span>
        {title}
        {optional ? <span className="text-[11px] font-normal text-[var(--admin-muted)]">opcional</span> : null}
      </p>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-[var(--admin-field)] p-0.5 text-[12px]">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`h-8 rounded-full px-3 ${
            value === option.id ? "bg-[#1d1d1f] text-white" : "text-[var(--admin-muted)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MediaTile({ item, on, onToggle }: { item: InstagramMediaItem; on: boolean; onToggle: () => void }) {
  // La miniatura es un enlace de Meta que caduca: si falla queda el texto.
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={item.caption || "Publicación"}
      className={`auto-media ${on ? "is-on" : ""}`}
    >
      {item.thumbnail && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        <span className="auto-media-text">{item.caption || (item.kind === "video" ? "Video" : "Publicación")}</span>
      )}
      {item.kind === "video" ? <span className="auto-media-kind">▶</span> : null}
      {on ? <span className="auto-media-check">✓</span> : null}
    </button>
  );
}
