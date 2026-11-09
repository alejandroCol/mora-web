"use client";

import { useEffect, useRef, useState } from "react";
import type { CrmSeller, WhatsAppConversation, WhatsAppMessage } from "@/growth/types";
import { LOST_REASON_LABEL, PIPELINE_LABEL, SUPPORT_STATUS_LABEL, followUpLabel, isSnoozed } from "@/crm/labels";
import { formatClock } from "@/crm/labels";
import type { CrmLostReason, WhatsAppConversationStatus } from "@/growth/types";
import { hasReferral, referralKindLabel, referralLink, referralTitle } from "@/crm/referral";
import { CrmAdCard } from "./CrmAdCard";
import { CrmVoiceNote } from "./CrmVoiceNote";

function initial(name: string, phone: string) {
  const source = name.trim() || phone;
  return source.slice(0, 1).toUpperCase();
}

function snoozeAt(kind: "1h" | "manana" | "sem") {
  const date = new Date();
  if (kind === "1h") return date.getTime() + 60 * 60 * 1000;
  if (kind === "manana") {
    date.setDate(date.getDate() + 1);
    date.setHours(10, 0, 0, 0);
    return date.getTime();
  }
  date.setDate(date.getDate() + 7);
  date.setHours(10, 0, 0, 0);
  return date.getTime();
}

export function CrmThread({
  conversation,
  messages,
  sellers,
  meUid,
  onBack,
  onFicha,
  onPatch,
  onSale,
  authorizedFetch,
}: {
  conversation: WhatsAppConversation;
  messages: WhatsAppMessage[];
  sellers: CrmSeller[];
  meUid?: string;
  onBack: () => void;
  onFicha: () => void;
  onPatch: (body: Record<string, unknown>) => void;
  onSale: () => void;
  authorizedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const support = (conversation.desk ?? "sales") === "support";
  const [more, setMore] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLightbox(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, conversation.id]);

  useEffect(() => {
    setMore(false);
  }, [conversation.id]);

  const tools = (
    <>
      <select
        value={conversation.assignedTo || ""}
        onChange={(event) => onPatch({ assignedTo: event.target.value || null })}
        className="crm-chat-select"
      >
        <option value="">Sin dueño</option>
        {sellers.map((seller) => (
          <option key={seller.uid} value={seller.uid}>
            {seller.uid === meUid ? `Yo · ${seller.name}` : seller.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onPatch({ pinned: !conversation.pinned })} className="crm-chat-chip">
        {conversation.pinned ? "Fijo" : "Fijar"}
      </button>
      {isSnoozed(conversation.snoozedUntil) ? (
        <button type="button" onClick={() => onPatch({ snoozedUntil: null })} className="crm-chat-chip">
          Despertar
        </button>
      ) : (
        <>
          <button type="button" onClick={() => onPatch({ snoozedUntil: snoozeAt("1h") })} className="crm-chat-chip">
            1 h
          </button>
          <button type="button" onClick={() => onPatch({ snoozedUntil: snoozeAt("manana") })} className="crm-chat-chip">
            Mañana
          </button>
          <button type="button" onClick={() => onPatch({ snoozedUntil: snoozeAt("sem") })} className="crm-chat-chip">
            Sem
          </button>
        </>
      )}
      <button type="button" onClick={() => onPatch({ desk: support ? "sales" : "support" })} className="crm-chat-chip">
        {support ? "A ventas" : "A soporte"}
      </button>
    </>
  );

  return (
    <>
      <header className="crm-chat-head">
        <div className="crm-chat-who">
          <button type="button" onClick={onBack} className="crm-chat-back lg:hidden" aria-label="Volver al inbox">
            <BackGlyph />
          </button>
          <span className="crm-chat-mark" aria-hidden>
            {initial(conversation.name, conversation.phone)}
          </span>
          <div className="min-w-0">
            <p className="crm-chat-name">{conversation.name || conversation.phone}</p>
            <span className="crm-chat-sub">
              <a href={`tel:+${conversation.phone}`} className="crm-chat-phone">
                +{conversation.phone}
              </a>
              {hasReferral(conversation.referral) ? (
                <AdChip
                  label={referralTitle(conversation.referral)}
                  kind={referralKindLabel(conversation.referral)}
                  href={referralLink(conversation.referral)}
                />
              ) : null}
            </span>
          </div>
        </div>
        <div className="crm-chat-tools">
          <div className="crm-chat-tools-wide">{tools}</div>
          <button type="button" onClick={onFicha} className="crm-chat-chip xl:hidden">
            Ficha
          </button>
          <button type="button" onClick={onSale} className="crm-chat-sale">
            Venta
          </button>
          <button
            type="button"
            className="crm-chat-more lg:hidden"
            aria-label={more ? "Cerrar acciones" : "Más acciones"}
            aria-expanded={more}
            onClick={() => setMore((open) => !open)}
          >
            {more ? "Cerrar" : "Más"}
          </button>
        </div>
        {more ? <div className="crm-chat-sheet lg:hidden">{tools}</div> : null}
        <div className="crm-chat-pipe">
          {support
            ? (["open", "waiting", "resolved"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onPatch({ supportStatus: status })}
                  className={`crm-pipe ${(conversation.supportStatus ?? "open") === status ? "is-on" : ""}`}
                >
                  {SUPPORT_STATUS_LABEL[status]}
                </button>
              ))
            : (Object.keys(PIPELINE_LABEL) as WhatsAppConversationStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onPatch({ status })}
                  className={`crm-pipe ${conversation.status === status ? "is-on" : ""}`}
                >
                  {PIPELINE_LABEL[status]}
                </button>
              ))}
        </div>
        {isSnoozed(conversation.snoozedUntil) ? (
          <p className="crm-chat-sleep">Vuelve {followUpLabel(conversation.snoozedUntil!)}</p>
        ) : null}
        {conversation.status === "closed" ? (
          <div className="crm-chat-pipe">
            {(Object.keys(LOST_REASON_LABEL) as CrmLostReason[]).map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => onPatch({ lostReason: reason })}
                className={`crm-pipe ${conversation.lostReason === reason ? "is-on" : ""}`}
              >
                {LOST_REASON_LABEL[reason]}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <div ref={scroller} className="crm-scroll flex-1 space-y-2 overflow-y-auto px-3 py-3 lg:px-5">
        {messages.map((message) => {
          if (message.type === "reaction") {
            // Reacción a un mensaje: línea corta, no burbuja. El emoji también
            // va pegado a la burbuja original (message.reaction).
            // «[reaction]» es de antes de guardar el emoji: solo sabemos que reaccionó.
            const legacy = message.text === "[reaction]";
            const emoji = legacy ? "" : message.text;
            const target = emoji && message.reactionTo ? messages.find((m) => m.id === message.reactionTo) : undefined;
            const quote = target ? reactionQuote(target) : "";
            const who = message.direction === "out" ? "Reaccionaste" : "Reaccionó";
            return (
              <p
                key={message.id}
                className={`crm-reaction-line ${message.direction === "out" ? "ml-auto text-right" : ""}`}
              >
                {emoji ? (
                  <>
                    <span className="crm-reaction-emoji">{emoji}</span> {who}
                    {quote ? <> a «{quote}»</> : " a un mensaje"}
                  </>
                ) : legacy ? (
                  `${who} a un mensaje`
                ) : (
                  `${who === "Reaccionó" ? "Quitó" : "Quitaste"} una reacción`
                )}
                <span className="crm-reaction-time">{formatClock(message.at)}</span>
              </p>
            );
          }
          const media = mediaKind(message);
          // «[foto]», «[audio]»… son relleno del webhook; con el archivo a la vista sobran.
          // En archivos el texto es el nombre y ya va en la tarjeta.
          const text =
            media && (PLACEHOLDER_RE.test(message.text) || media === "document") ? "" : message.text;
          const bubble = (
            <div
              key={message.id}
              className={`crm-bubble max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-6 ${
                message.direction === "out" ? "admin-bubble-out ml-auto" : "admin-bubble-in"
              } ${media === "image" || media === "sticker" ? "has-media" : ""} ${message.reaction ? "has-reaction" : ""}`}
            >
              {message.reaction ? (
                <span className="crm-reaction-badge" title="Reacción del cliente">
                  {message.reaction}
                </span>
              ) : null}
              {media && message.mediaId ? (
                <MediaBubble
                  kind={media}
                  mediaId={message.mediaId}
                  mimeType={message.mimeType}
                  fileName={message.type === "document" ? message.text : ""}
                  authorizedFetch={authorizedFetch}
                  onOpen={(src) => setLightbox({ src, caption: text })}
                />
              ) : null}
              {text ? <p className="whitespace-pre-wrap break-words">{text}</p> : null}
              <p className={`mt-1 text-[10px] ${message.direction === "out" ? "text-white/50" : "text-white/35"}`}>
                {formatClock(message.at)}
                {message.status && message.direction === "out" ? ` · ${message.status}` : ""}
              </p>
            </div>
          );
          if (!hasReferral(message.referral)) return bubble;
          // El mensaje entró desde un anuncio: la tarjeta va pegada encima
          // para saber qué vio el cliente justo antes de escribir.
          return (
            <div key={message.id} className="crm-ad-entry">
              <CrmAdCard referral={message.referral} compact />
              {bubble}
            </div>
          );
        })}
      </div>

      {lightbox ? (
        <div
          className="crm-lightbox"
          role="dialog"
          aria-label="Imagen"
          onClick={() => setLightbox(null)}
        >
          <button type="button" className="crm-lightbox-close" aria-label="Cerrar">
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.src}
            alt={lightbox.caption}
            className="crm-lightbox-img"
            onClick={(event) => event.stopPropagation()}
          />
          {lightbox.caption ? <p className="crm-lightbox-caption">{lightbox.caption}</p> : null}
        </div>
      ) : null}
    </>
  );
}

type MediaKind = "image" | "sticker" | "video" | "audio" | "document";

const PLACEHOLDER_RE = /^\[(foto|audio|video|archivo|sticker|voice|document|image)\]$/i;

/** Cita corta del mensaje reaccionado, para «Reaccionó ❤️ a «…»». */
function reactionQuote(message: WhatsAppMessage) {
  const kind = mediaKind(message);
  if (kind === "image" || kind === "sticker") return "foto";
  if (kind === "audio") return "nota de voz";
  if (kind === "video") return "video";
  if (kind === "document") return "archivo";
  const text = message.text.replace(/\s+/g, " ").trim();
  if (!text || PLACEHOLDER_RE.test(text)) return "";
  return text.length > 40 ? `${text.slice(0, 40).trimEnd()}…` : text;
}

function mediaKind(message: WhatsAppMessage): MediaKind | null {
  if (!message.mediaId) return null;
  const type = message.type;
  const mime = message.mimeType ?? "";
  if (type === "image" || mime.startsWith("image/")) return type === "sticker" ? "sticker" : "image";
  if (type === "sticker") return "sticker";
  if (type === "video" || mime.startsWith("video/")) return "video";
  if (type === "audio" || type === "voice" || mime.startsWith("audio/")) return "audio";
  if (type === "document") return "document";
  return null;
}

function MediaBubble({
  kind,
  mediaId,
  mimeType,
  fileName,
  authorizedFetch,
  onOpen,
}: {
  kind: MediaKind;
  mediaId: string;
  mimeType?: string;
  fileName?: string;
  authorizedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  onOpen: (src: string) => void;
}) {
  const [src, setSrc] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url = "";
    let cancelled = false;
    void authorizedFetch(`/api/admin/whatsapp/media/${mediaId}`)
      .then((res) => (res.ok ? res.blob() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setFailed(true);
          return;
        }
        setBlob(data);
        url = URL.createObjectURL(data);
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [authorizedFetch, mediaId]);

  const label =
    kind === "image" ? "Foto" : kind === "sticker" ? "Sticker" : kind === "video" ? "Video" : kind === "audio" ? "Audio" : "Archivo";

  if (failed) {
    return <p className="crm-media-note">{label} no disponible (WhatsApp guarda los archivos 30 días).</p>;
  }
  if (!src) {
    return <div className={`crm-media-skeleton ${kind === "image" || kind === "sticker" ? "is-image" : ""}`}>{label}…</div>;
  }

  if (kind === "image" || kind === "sticker") {
    return (
      <button
        type="button"
        onClick={() => onOpen(src)}
        className={`crm-media-img-btn ${kind === "sticker" ? "is-sticker" : ""}`}
        aria-label="Ver imagen completa"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="crm-media-img" />
      </button>
    );
  }
  if (kind === "video") {
    return <video src={src} controls playsInline preload="metadata" className="crm-media-video" />;
  }
  if (kind === "audio" && blob) {
    return <CrmVoiceNote blob={blob} mimeType={mimeType} />;
  }
  return (
    <a
      href={src}
      download={fileName || "archivo"}
      target="_blank"
      rel="noreferrer"
      className="crm-media-file"
    >
      <span className="crm-media-file-icon" aria-hidden>
        ⬇
      </span>
      <span className="min-w-0">
        <span className="block truncate">{fileName || "Archivo"}</span>
        <span className="block text-[10px] opacity-60">{mimeType?.split("/")[1]?.toUpperCase() || "Descargar"}</span>
      </span>
    </a>
  );
}

/** Chip de cabecera: «Anuncio · Mora Ultra −20 %». Abre el post si hay link. */
function AdChip({ label, kind, href }: { label: string; kind: string; href: string }) {
  const text = label === kind ? kind : `${kind} · ${label}`;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="crm-ad-chip" title={`Ver ${kind.toLowerCase()}`}>
        {text}
      </a>
    );
  }
  return <span className="crm-ad-chip">{text}</span>;
}

function BackGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
