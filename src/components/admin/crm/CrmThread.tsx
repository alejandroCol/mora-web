"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CrmDesk, CrmSeller, WhatsAppConversation, WhatsAppMessage } from "@/growth/types";
import { channelOf, conversationHandle, conversationTitle, instagramProfileUrl } from "@/crm/channel";
import {
  DESK_LABEL,
  LOST_REASON_LABEL,
  PIPELINE_LABEL,
  SUPPORT_STATUS_LABEL,
  followUpLabel,
  isSnoozed,
  needsReply,
  replyDismissed,
} from "@/crm/labels";
import { formatClock } from "@/crm/labels";
import type { CrmLostReason, WhatsAppConversationStatus } from "@/growth/types";
import { hasReferral, referralKindLabel, referralLink, referralTitle } from "@/crm/referral";
import { parseOrderData, type OrderData } from "@/crm/orderData";
import { quoteText } from "@/crm/quote";
import { CrmAdCard } from "./CrmAdCard";
import { CrmVoiceNote } from "./CrmVoiceNote";

function initial(title: string) {
  return title.replace(/^[@+]/, "").slice(0, 1).toUpperCase();
}

/** Quién escribió cuando no fue una persona del equipo desde el CRM. */
const OUTBOUND_ORIGIN: Record<string, string> = {
  auto: "automático",
  instagram: "desde Instagram",
};

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

/** Píxeles desde arriba a los que se pide la página anterior, antes de tocar el borde. */
const OLDER_EDGE = 600;

export function CrmThread({
  conversation,
  messages,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  sellers,
  meUid,
  onBack,
  onFicha,
  onPatch,
  onSale,
  onUseInSale,
  authorizedFetch,
}: {
  conversation: WhatsAppConversation;
  messages: WhatsAppMessage[];
  /** Hay mensajes más viejos en el servidor que aún no se pidieron. */
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  sellers: CrmSeller[];
  meUid?: string;
  onBack: () => void;
  onFicha: () => void;
  onPatch: (body: Record<string, unknown>) => void;
  onSale: () => void;
  /** Con la venta abierta: pasa los datos de un mensaje del cliente a la venta. */
  onUseInSale?: (data: OrderData) => void;
  authorizedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const support = (conversation.desk ?? "sales") === "support";
  const creators = conversation.desk === "creators";
  const instagram = channelOf(conversation) === "instagram";
  const title = conversationTitle(conversation);
  const handle = conversationHandle(conversation);
  const [more, setMore] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  const selling = Boolean(onUseInSale);
  const saleData = useMemo(() => {
    const found = new Map<string, OrderData>();
    if (!selling) return found;
    for (const message of messages) {
      if (message.direction !== "in" || !message.text) continue;
      const parsed = parseOrderData(message.text);
      if (parsed.found > 0) found.set(message.id, parsed.data);
    }
    return found;
  }, [messages, selling]);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLightbox(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // Abajo del todo: los mensajes nuevos y las fotos que terminan de cargar no te despegan.
  const pinned = useRef(true);
  const view = useRef({ conversationId: "", firstId: "", lastId: "", height: 0, top: 0 });

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const prev = view.current;
    const firstId = messages[0]?.id ?? "";
    const lastId = messages[messages.length - 1]?.id ?? "";
    // Leer la altura fuerza el layout; si el navegador ya ancló el scroll, scrollTop ya se movió.
    const height = el.scrollHeight;
    if (prev.conversationId !== conversation.id || !prev.lastId) {
      el.scrollTop = height;
      pinned.current = true;
    } else if (firstId !== prev.firstId && lastId === prev.lastId) {
      if (el.scrollTop === prev.top) el.scrollTop = prev.top + (height - prev.height);
    } else if (lastId !== prev.lastId) {
      if (pinned.current || messages[messages.length - 1]?.direction === "out") {
        el.scrollTop = height;
        pinned.current = true;
      }
    }
    view.current = { conversationId: conversation.id, firstId, lastId, height: el.scrollHeight, top: el.scrollTop };
  }, [messages, conversation.id]);

  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
      view.current.height = el.scrollHeight;
      view.current.top = el.scrollTop;
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  // Cerca del borde de arriba (o el hilo no llena la pantalla): la página anterior.
  useEffect(() => {
    const el = scroller.current;
    if (el && hasOlder && !loadingOlder && el.scrollTop < OLDER_EDGE) onLoadOlder();
  }, [hasOlder, loadingOlder, messages, onLoadOlder]);

  function jumpTo(id: string) {
    const target = content.current?.querySelector<HTMLElement>(`[data-mid="${CSS.escape(id)}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("is-flash");
    void target.offsetWidth;
    target.classList.add("is-flash");
  }

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    view.current.top = el.scrollTop;
    if (hasOlder && !loadingOlder && el.scrollTop < OLDER_EDGE) onLoadOlder();
  }

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
      {needsReply(conversation) ? (
        <button
          type="button"
          onClick={() => onPatch({ replyIgnoredAt: conversation.lastInboundAt || conversation.lastAt || Date.now() })}
          className="crm-chat-chip"
        >
          Ignorar
        </button>
      ) : replyDismissed(conversation) ? (
        <button type="button" onClick={() => onPatch({ replyIgnoredAt: null })} className="crm-chat-chip">
          Volver arriba
        </button>
      ) : null}
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
      <select
        value={conversation.desk ?? "sales"}
        onChange={(event) => onPatch({ desk: event.target.value as CrmDesk })}
        className="crm-chat-select"
        aria-label="Mesa"
      >
        {(Object.keys(DESK_LABEL) as CrmDesk[]).map((item) => (
          <option key={item} value={item}>
            {DESK_LABEL[item]}
          </option>
        ))}
      </select>
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
            {initial(title)}
          </span>
          <div className="min-w-0">
            <p className="crm-chat-name">{title}</p>
            <span className="crm-chat-sub">
              {instagram ? (
                <>
                  <span className="crm-channel-badge">Instagram</span>
                  {conversation.igUsername ? (
                    <a
                      href={instagramProfileUrl(conversation.igUsername)}
                      target="_blank"
                      rel="noreferrer"
                      className="crm-chat-phone"
                      title="Ver su perfil"
                    >
                      {handle}
                    </a>
                  ) : null}
                  {conversation.phone ? (
                    <a href={`tel:+${conversation.phone}`} className="crm-chat-phone">
                      +{conversation.phone}
                    </a>
                  ) : null}
                </>
              ) : (
                <a href={`tel:+${conversation.phone}`} className="crm-chat-phone">
                  +{conversation.phone}
                </a>
              )}
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
        {/* Con creadoras no hay embudo de venta. */}
        {creators ? null : <div className="crm-chat-pipe">
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
        </div>}
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

      <div ref={scroller} onScroll={onScroll} className="crm-scroll flex-1 overflow-y-auto px-3 py-3 lg:px-5">
        <div ref={content} className="space-y-2">
        {hasOlder ? (
          <p className="h-8 text-center text-[11px] leading-8 text-white/35" aria-live="polite">
            {loadingOlder ? "Cargando mensajes anteriores…" : ""}
          </p>
        ) : null}
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
          if (message.type === "deleted") {
            return (
              <p key={message.id} className={`crm-reaction-line ${message.direction === "out" ? "ml-auto text-right" : ""}`}>
                {message.text || "Eliminó este mensaje"}
                <span className="crm-reaction-time">{formatClock(message.at)}</span>
              </p>
            );
          }
          const media = mediaKind(message);
          const link = safeLink(message.linkUrl);
          const origin = message.direction === "out" && message.by ? OUTBOUND_ORIGIN[message.by] : "";
          // Antes del campo `fileName`, el texto de un documento era su nombre.
          const fileName = message.fileName ?? (message.type === "document" ? message.text : "");
          // «[foto]», «[audio]»… son relleno del webhook; con el archivo a la vista sobran.
          // El nombre del archivo ya va en la tarjeta; ubicación y contactos tienen la suya.
          const text =
            (media && (PLACEHOLDER_RE.test(message.text) || message.text === fileName)) ||
            message.location ||
            message.contacts?.length ||
            message.type === "unsupported"
              ? ""
              : message.text;
          const original = message.replyTo ? messages.find((m) => m.id === message.replyTo) : undefined;
          const quoted = original
            ? { text: quoteText(original), direction: original.direction }
            : message.quote;
          const bubble = (
            <div
              key={message.id}
              data-mid={message.id}
              className={`crm-bubble max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-6 ${
                message.direction === "out" ? "admin-bubble-out ml-auto" : "admin-bubble-in"
              } ${media === "image" || media === "sticker" ? "has-media" : ""} ${message.reaction ? "has-reaction" : ""}`}
            >
              {message.reaction ? (
                <span className="crm-reaction-badge" title="Reacción del cliente">
                  {message.reaction}
                </span>
              ) : null}
              {message.replyTo ? (
                <button
                  type="button"
                  className={`crm-quote ${quoted?.direction === "out" ? "is-out" : ""}`}
                  onClick={() => (original ? jumpTo(original.id) : undefined)}
                  disabled={!original}
                  title={original ? "Ir al mensaje" : undefined}
                >
                  <span className="crm-quote-who">
                    {quoted?.direction === "out" ? "Mora" : quoted?.direction === "in" ? title : "Respondió a"}
                  </span>
                  <span className="crm-quote-text">{quoted?.text || "un mensaje que no está en el CRM"}</span>
                </button>
              ) : null}
              {media ? (
                <MediaBubble
                  kind={media}
                  source={mediaSource(message)}
                  stored={Boolean(message.mediaPath)}
                  mimeType={message.mimeType}
                  fileName={fileName}
                  authorizedFetch={authorizedFetch}
                  onOpen={(src) => setLightbox({ src, caption: text })}
                />
              ) : null}
              {message.location ? <LocationCard location={message.location} /> : null}
              {message.contacts?.map((contact, index) => (
                <ContactCard key={index} contact={contact} />
              ))}
              {message.type === "unsupported" ? (
                <p className="crm-media-note">
                  WhatsApp no deja ver este tipo de mensaje aquí (ver una vez, encuesta, evento…). Pídele que lo
                  reenvíe como foto, video o archivo.
                </p>
              ) : null}
              {link ? (
                <a href={link} target="_blank" rel="noreferrer" className="crm-bubble-link">
                  {message.linkLabel || "Abrir enlace"} ↗
                </a>
              ) : !text && !media && message.linkLabel ? (
                // El enlace caducó o Meta no lo mandó: al menos se sabe qué fue.
                <p className="crm-media-note">{message.linkLabel}</p>
              ) : null}
              {text ? <p className="whitespace-pre-wrap break-words">{text}</p> : null}
              {onUseInSale && saleData.has(message.id) ? (
                <button
                  type="button"
                  className="crm-use-sale"
                  onClick={() => onUseInSale(saleData.get(message.id)!)}
                >
                  Usar en venta
                </button>
              ) : null}
              <p className={`mt-1 text-[10px] ${message.direction === "out" ? "text-white/50" : "text-white/35"}`}>
                {formatClock(message.at)}
                {message.status && message.direction === "out" ? ` · ${message.status}` : ""}
                {origin ? ` · ${origin}` : ""}
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

const PLACEHOLDER_RE = /^\[(foto|audio|video|archivo|sticker|voice|document|image|unsupported)\]$/i;

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

/** Archivo del mensaje: WhatsApp lo sirve Meta por id; Instagram se copia a nuestro Storage. */
function mediaSource(message: WhatsAppMessage) {
  if (message.mediaPath) return `/api/admin/crm/media?path=${encodeURIComponent(message.mediaPath)}`;
  return `/api/admin/whatsapp/media/${message.mediaId}`;
}

/** Enlaces que llegan en un mensaje: solo https. */
function safeLink(url: string | undefined) {
  if (!url) return "";
  try {
    return new URL(url).protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function mediaKind(message: WhatsAppMessage): MediaKind | null {
  if (!message.mediaId && !message.mediaPath) return null;
  const type = message.type;
  const mime = message.mimeType ?? "";
  if (type === "image" || mime.startsWith("image/")) return type === "sticker" ? "sticker" : "image";
  if (type === "sticker") return "sticker";
  if (type === "video" || mime.startsWith("video/")) return "video";
  if (type === "audio" || type === "voice" || mime.startsWith("audio/")) return "audio";
  // Cualquier otro archivo (PDF, ZIP, Excel…) se ofrece para descargar.
  return "document";
}

function MediaBubble({
  kind,
  source,
  stored,
  mimeType,
  fileName,
  authorizedFetch,
  onOpen,
}: {
  kind: MediaKind;
  /** Ruta del API que entrega el archivo. */
  source: string;
  /** Está en nuestro Storage (Instagram) y no en Meta (WhatsApp, 30 días). */
  stored: boolean;
  mimeType?: string;
  fileName?: string;
  authorizedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  onOpen: (src: string) => void;
}) {
  const [src, setSrc] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  // Videos y documentos llegan a 100 MB y pasan por el servidor: se bajan solo si los van a abrir.
  const [wanted, setWanted] = useState(kind !== "video" && kind !== "document");
  // .MOV de iPhone en HEVC: Chrome no lo reproduce; queda la descarga.
  const [unplayable, setUnplayable] = useState(false);
  const download = useRef<HTMLAnchorElement>(null);
  const name = fileName || (kind === "video" ? "video" : "archivo");

  useEffect(() => {
    if (!wanted) return;
    let url = "";
    let cancelled = false;
    void authorizedFetch(source)
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
  }, [authorizedFetch, source, wanted]);

  // El vendedor ya tocó «Descargar»: no hacerle tocar otra vez cuando termina de bajar.
  useEffect(() => {
    if (src && kind === "document") download.current?.click();
  }, [src, kind]);

  const label =
    kind === "image" ? "Foto" : kind === "sticker" ? "Sticker" : kind === "video" ? "Video" : kind === "audio" ? "Audio" : "Archivo";

  if (failed) {
    return (
      <p className="crm-media-note">
        {label} no disponible{stored ? "." : " (WhatsApp guarda los archivos 30 días)."}
      </p>
    );
  }
  const detail = mimeType?.split("/")[1]?.replace(/^quicktime$/, "mov").toUpperCase() || "Descargar";
  const fileCard = (body: ReactNode) => (
    <>
      <span className="crm-media-file-icon" aria-hidden>
        ⬇
      </span>
      <span className="min-w-0">
        <span className="block truncate">{name}</span>
        <span className="block text-[10px] opacity-60">{body}</span>
      </span>
    </>
  );
  if (!wanted && kind === "document") {
    return (
      <button type="button" onClick={() => setWanted(true)} className="crm-media-file text-left">
        {fileCard(detail)}
      </button>
    );
  }
  if (!wanted) {
    return (
      <button type="button" onClick={() => setWanted(true)} className="crm-media-skeleton crm-media-play">
        ▶ Ver video{fileName ? ` · ${fileName}` : ""}
      </button>
    );
  }
  if (!src) {
    if (kind === "document") return <div className="crm-media-file">{fileCard("Descargando…")}</div>;
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
  if (kind === "video" && !unplayable) {
    return (
      <video
        src={src}
        controls
        autoPlay
        playsInline
        preload="metadata"
        className="crm-media-video"
        onError={() => setUnplayable(true)}
      />
    );
  }
  if (kind === "audio" && blob) {
    return <CrmVoiceNote blob={blob} mimeType={mimeType} />;
  }
  return (
    <a ref={download} href={src} download={name} target="_blank" rel="noreferrer" className="crm-media-file">
      {fileCard(unplayable ? `${detail} · el navegador no lo reproduce, descárgalo` : detail)}
    </a>
  );
}

function LocationCard({ location }: { location: NonNullable<WhatsAppMessage["location"]> }) {
  const href = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="crm-media-file">
      <span className="crm-media-file-icon" aria-hidden>
        📍
      </span>
      <span className="min-w-0">
        <span className="block truncate">{location.name || "Ubicación"}</span>
        <span className="block text-[10px] opacity-60">{location.address || "Abrir en el mapa"}</span>
      </span>
    </a>
  );
}

function ContactCard({ contact }: { contact: NonNullable<WhatsAppMessage["contacts"]>[number] }) {
  return (
    <div className="crm-media-file">
      <span className="crm-media-file-icon" aria-hidden>
        👤
      </span>
      <span className="min-w-0">
        <span className="block truncate">{contact.name}</span>
        <span className="block text-[10px] opacity-60 select-all">{contact.phones.join(" · ") || "Sin número"}</span>
      </span>
    </div>
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
