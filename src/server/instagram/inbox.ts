import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/commerce/paths";
import { instagramConversationId } from "@/crm/channel";
import { HUMAN_AGENT_WINDOW_MS, WINDOW_MS } from "@/crm/labels";
import type { WhatsAppConversation, WhatsAppMessage, WhatsAppReferral } from "@/growth/types";
import { detectColombianMobile, splitForInstagram } from "@/instagram/text";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadGrowthSettings } from "../growthSettings";
import { upsertLead } from "../leads";
import { findCommentOrigin } from "./automations";
import {
  connectionOf,
  fetchInstagramProfile,
  imageMessage,
  sendInstagramMessage,
  type InstagramConnection,
} from "./graph";
import { deleteCrmMedia, isMetaFileUrl, storeInboundAttachment, storeOutboundImage } from "./media";

/**
 * DMs de Instagram dentro del CRM.
 *
 * Viven en la misma colección que WhatsApp (`whatsappConversations/ig_{persona}`):
 * el tablero, las notas, la asignación y el push a la app Super Admin funcionan igual.
 * Diferencias con WhatsApp: no hay teléfono, no hay plantillas (pasada la ventana
 * no se puede escribir) y los archivos llegan como enlaces que caducan.
 */

function conversations() {
  return adminDb().collection(COLLECTIONS.whatsappConversations);
}

function messages(conversationId: string) {
  return conversations().doc(conversationId).collection("messages");
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

/** El id de Meta sirve como id del documento salvo por la barra. */
function messageDocId(mid: string) {
  return mid.replace(/\//g, "_");
}

function toMillis(timestamp: unknown) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return Date.now();
  return value < 1e12 ? value * 1000 : value;
}

// ---------------------------------------------------------------------------
// Entrada (webhook `messaging`)
// ---------------------------------------------------------------------------

type Attachment = { type?: string; payload?: { url?: string; title?: string } };

export type InstagramMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
    attachments?: Attachment[];
    reply_to?: { mid?: string; story?: { url?: string } };
  };
  postback?: { mid?: string; title?: string };
  reaction?: { mid?: string; action?: string; emoji?: string };
  read?: { mid?: string };
};

type Context = {
  connection: InstagramConnection;
  /** Id de nuestra cuenta según el propio aviso (`entry.id`). */
  businessId: string;
};

type Part = Pick<WhatsAppMessage, "type" | "text" | "mediaPath" | "mimeType" | "linkUrl" | "linkLabel"> & {
  preview: string;
};

const FILE_KINDS: Record<string, { type: string; placeholder: string; preview: string }> = {
  image: { type: "image", placeholder: "[foto]", preview: "📷 Foto" },
  video: { type: "video", placeholder: "[video]", preview: "🎬 Video" },
  audio: { type: "audio", placeholder: "[audio]", preview: "🎤 Nota de voz" },
  file: { type: "document", placeholder: "Archivo", preview: "📎 Archivo" },
};

const SHARE_LABELS: Record<string, string> = {
  share: "Compartió una publicación",
  ig_post: "Compartió una publicación",
  post: "Compartió una publicación",
  ig_reel: "Compartió un reel",
  reel: "Compartió un reel",
  story_mention: "Te mencionó en su historia",
};

function safeLink(url: string | undefined) {
  return url && isMetaFileUrl(url) ? url : undefined;
}

/** Un aviso de Meta puede traer texto y varios adjuntos: cada uno es una burbuja. */
async function partsOf(event: InstagramMessagingEvent, conversationId: string, mid: string): Promise<Part[]> {
  if (event.postback) {
    const text = event.postback.title?.trim() || "[botón]";
    return [{ type: "text", text, preview: text }];
  }
  const message = event.message ?? {};
  if (message.is_unsupported) {
    const text = "Mensaje que Instagram no deja ver aquí. Ábrelo en la app.";
    return [{ type: "text", text, preview: "Mensaje no compatible" }];
  }

  const parts: Part[] = [];
  const text = message.text?.trim();
  if (text) {
    const story = safeLink(message.reply_to?.story?.url);
    parts.push({
      type: "text",
      text,
      preview: text,
      ...(story ? { linkUrl: story, linkLabel: "Respondió a tu historia" } : {}),
    });
  }

  for (const [index, attachment] of (message.attachments ?? []).entries()) {
    const kind = attachment.type ?? "";
    const url = attachment.payload?.url;
    const file = FILE_KINDS[kind];
    if (file && url) {
      const stored = await storeInboundAttachment({ url, conversationId, messageId: `${mid}:${index}` });
      parts.push(
        stored
          ? { type: file.type, text: file.placeholder, preview: file.preview, mediaPath: stored.path, mimeType: stored.mimeType }
          : // No se pudo copiar: queda el enlace de Meta, que sirve unos días.
            { type: "text", text: file.preview, preview: file.preview, linkUrl: safeLink(url), linkLabel: "Abrir archivo" },
      );
      continue;
    }
    const label = SHARE_LABELS[kind];
    if (label) {
      parts.push({
        type: "text",
        text: attachment.payload?.title?.trim() || "",
        preview: label,
        linkUrl: safeLink(url),
        linkLabel: label,
      });
      continue;
    }
    if (kind === "template") {
      // Así repite Meta nuestros propios mensajes con botón (los de las automatizaciones).
      parts.push({ type: "text", text: "Mensaje con botón", preview: "Mensaje con botón" });
      continue;
    }
    parts.push({ type: "text", text: `[${kind || "adjunto"}]`, preview: "Adjunto" });
  }

  return parts.length > 0 ? parts : [{ type: "text", text: "[mensaje vacío]", preview: "Mensaje" }];
}

async function writeParts(input: {
  conversationId: string;
  mid: string;
  parts: Part[];
  direction: "in" | "out";
  at: number;
  by?: string;
}) {
  const base = messageDocId(input.mid);
  await Promise.all(
    input.parts.map((part, index) => {
      const id = index === 0 ? base : `${base}_${index}`;
      const message: WhatsAppMessage = {
        id,
        // Id del mensaje en Meta: todas las burbujas de un mismo aviso lo comparten.
        waId: input.mid,
        direction: input.direction,
        type: part.type,
        text: part.text,
        at: input.at + index,
        status: input.direction === "in" ? "received" : "sent",
        mediaPath: part.mediaPath,
        mimeType: part.mimeType,
        linkUrl: part.linkUrl,
        linkLabel: part.linkLabel,
        by: input.by,
      };
      return messages(input.conversationId).doc(id).set(compact(message), { merge: true });
    }),
  );
}

/**
 * Procesa un aviso de mensajería de Instagram.
 * Devuelve `true` si cambió algo en el CRM.
 */
export async function ingestInstagramMessaging(event: InstagramMessagingEvent, context: Context) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  if (!senderId || !recipientId) return false;

  const fromUs =
    Boolean(event.message?.is_echo) ||
    senderId === context.businessId ||
    senderId === context.connection.accountId;
  const igUserId = fromUs ? recipientId : senderId;
  const conversationId = instagramConversationId(igUserId);
  const at = toMillis(event.timestamp);

  if (event.read?.mid) {
    // `update` y no `set`: si ese mensaje no está en el CRM, no crear un hueco.
    await messages(conversationId)
      .doc(messageDocId(event.read.mid))
      .update({ status: "read" })
      .catch(() => undefined);
    return false;
  }
  if (event.reaction?.mid) return recordReaction(conversationId, event.reaction, fromUs, at);
  if (event.message?.is_deleted && event.message.mid) return removeMessage(conversationId, event.message.mid);
  if (fromUs) return recordEcho(conversationId, event, at);
  return recordInbound(conversationId, igUserId, event, at, context);
}

async function recordInbound(
  conversationId: string,
  igUserId: string,
  event: InstagramMessagingEvent,
  at: number,
  context: Context,
) {
  const mid = event.message?.mid ?? event.postback?.mid;
  if (!mid) return false;

  const ref = conversations().doc(conversationId);
  const [snap, known] = await Promise.all([ref.get(), messages(conversationId).doc(messageDocId(mid)).get()]);
  // Meta repite avisos: si el mensaje ya está, no se vuelve a contar como no leído.
  if (known.exists) return false;
  const prev = snap.data() as WhatsAppConversation | undefined;
  const isFirst = !snap.exists;

  // Todo lo lento (perfil, adjuntos, origen) va ANTES de escribir el mensaje:
  // el push al equipo se dispara con el mensaje y lee la conversación un segundo después.
  const [parts, profile, origin] = await Promise.all([
    partsOf(event, conversationId, mid),
    prev?.igUsername
      ? null
      : fetchInstagramProfile(context.connection, igUserId).catch(() => null),
    isFirst ? findCommentOrigin(igUserId).catch(() => null) : null,
  ]);

  const igUsername = profile?.username || prev?.igUsername || "";
  // Siempre con nombre: el push usa este campo como título.
  const name = prev?.name || profile?.name || (igUsername ? `@${igUsername}` : "Instagram");
  const phone = prev?.phone || detectColombianMobile(event.message?.text ?? "");

  if (origin?.messageId && origin.dmText) {
    // El DM automático que recibió por comentar: así el vendedor ve a qué está respondiendo.
    await writeParts({
      conversationId,
      mid: origin.messageId,
      parts: [{ type: "text", text: origin.dmText, preview: origin.dmText }],
      direction: "out",
      at: origin.sentAt ?? at - 1,
      by: "auto",
    });
  }
  await writeParts({ conversationId, mid, parts, direction: "in", at });

  const desk = prev?.desk ?? "sales";
  const sold = prev?.status === "sold";
  const closed = prev?.status === "closed" && !sold;
  await ref.set(
    compact({
      id: conversationId,
      channel: "instagram" as const,
      igUserId,
      igUsername,
      phone,
      name,
      lastMessage: parts[0].preview,
      lastDirection: "in" as const,
      lastAt: at,
      lastInboundAt: at,
      snoozedUntil: 0,
      unread: (prev?.unread ?? 0) + 1,
      status: closed ? "interested" : (prev?.status ?? "new"),
      desk,
      source: prev?.source ?? "organic",
      ...(desk === "support" && (prev?.supportStatus ?? "open") === "resolved"
        ? { supportStatus: "open" as const }
        : {}),
      ...(origin ? { referral: compact(commentReferral(origin)) } : {}),
    }),
    { merge: true },
  );

  const lead = await upsertLead({
    source: "instagram",
    name,
    phone,
    igUserId,
    igUsername,
    lastEvent: origin ? "Lead" : "Contact",
    conversationId,
    status: "interested",
  }).catch(() => null);
  if (lead && prev?.leadId !== lead.id) await ref.set({ leadId: lead.id }, { merge: true });
  return true;
}

/** El comentario que lo trajo, con la misma forma que el anuncio de WhatsApp: la ficha ya sabe pintarlo. */
function commentReferral(origin: NonNullable<Awaited<ReturnType<typeof findCommentOrigin>>>): WhatsAppReferral {
  return {
    sourceType: "comment",
    sourceUrl: origin.permalink,
    headline: origin.automationName,
    body: `«${origin.text}»`,
    at: origin.at,
  };
}

/**
 * Mensaje enviado por nosotros que Meta nos repite. Si salió del CRM ya está
 * guardado; si alguien respondió desde la app de Instagram, se agrega al hilo.
 * No crea conversaciones: el DM automático a quien aún no responde no debe
 * llenar la bandeja.
 */
async function recordEcho(conversationId: string, event: InstagramMessagingEvent, at: number) {
  const mid = event.message?.mid;
  if (!mid) return false;
  const ref = conversations().doc(conversationId);
  const [snap, known] = await Promise.all([ref.get(), messages(conversationId).doc(messageDocId(mid)).get()]);
  if (!snap.exists || known.exists) return false;

  const parts = await partsOf(event, conversationId, mid);
  await writeParts({ conversationId, mid, parts, direction: "out", at, by: "instagram" });
  await ref.set(
    { lastMessage: parts[0].preview, lastDirection: "out", lastAt: at, lastOutboundAt: at },
    { merge: true },
  );
  return true;
}

async function recordReaction(
  conversationId: string,
  reaction: NonNullable<InstagramMessagingEvent["reaction"]>,
  fromUs: boolean,
  at: number,
) {
  const ref = conversations().doc(conversationId);
  const snap = await ref.get();
  if (!snap.exists || !reaction.mid) return false;
  const prev = snap.data() as WhatsAppConversation;
  const target = messageDocId(reaction.mid);
  const emoji = reaction.action === "unreact" ? "" : reaction.emoji || "❤️";

  const line: WhatsAppMessage = {
    id: `${target}_r${at}`,
    direction: fromUs ? "out" : "in",
    type: "reaction",
    text: emoji,
    at,
    status: fromUs ? "sent" : "received",
    reactionTo: target,
  };
  await messages(conversationId).doc(line.id).set(line, { merge: true });
  if (fromUs) return true;

  // La reacción del cliente también va pegada a la burbuja original.
  await messages(conversationId).doc(target).update({ reaction: emoji }).catch(() => undefined);
  // Avisa (no leído) pero no pone el chat en «Te toca»: un ❤️ no pide respuesta.
  await ref.set(
    {
      lastMessage: emoji ? `Reaccionó ${emoji} a tu mensaje` : "Quitó una reacción",
      lastAt: at,
      unread: (prev.unread ?? 0) + 1,
    },
    { merge: true },
  );
  return true;
}

/** La persona anuló el envío: Meta exige borrar el contenido. */
async function removeMessage(conversationId: string, mid: string) {
  const snap = await messages(conversationId).where("waId", "==", mid).get();
  if (snap.empty) return false;
  await Promise.all(
    snap.docs.map(async (doc) => {
      const path = (doc.data() as WhatsAppMessage).mediaPath;
      if (path) await deleteCrmMedia(path).catch(() => undefined);
      await doc.ref.update({
        type: "deleted",
        text: "Eliminó este mensaje",
        mediaPath: FieldValue.delete(),
        mimeType: FieldValue.delete(),
        linkUrl: FieldValue.delete(),
        linkLabel: FieldValue.delete(),
      });
    }),
  );
  return true;
}

// ---------------------------------------------------------------------------
// Salida (el equipo escribe desde el CRM)
// ---------------------------------------------------------------------------

type Actor = { by?: string; byName?: string; claim?: boolean };

export const INSTAGRAM_IMAGE_MIME = ["image/jpeg", "image/png"] as const;
export const INSTAGRAM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Instagram no tiene plantillas: solo se puede escribir dentro de las 24 h
 * desde el último mensaje de la persona (7 días con el permiso «Human Agent»).
 */
async function openChat(conversation: WhatsAppConversation) {
  const settings = await loadGrowthSettings();
  const connection = connectionOf(settings);
  if (!conversation.igUserId) {
    throw Object.assign(new Error("Este chat no es de Instagram."), { status: 400 });
  }
  const age = conversation.lastInboundAt ? Date.now() - conversation.lastInboundAt : Infinity;
  const limit = settings.instagramHumanAgent ? HUMAN_AGENT_WINDOW_MS : WINDOW_MS;
  if (age > limit) {
    throw Object.assign(
      new Error("Instagram ya no deja escribirle: pasó la ventana desde su último mensaje. Podrás responder cuando vuelva a escribir."),
      { status: 400 },
    );
  }
  return { connection, recipient: { id: conversation.igUserId }, humanAgent: age > WINDOW_MS };
}

async function recordOutbound(
  conversation: WhatsAppConversation,
  message: WhatsAppMessage,
  preview: string,
  actor: Actor,
) {
  await messages(conversation.id).doc(message.id).set(compact(message), { merge: true });
  const claim =
    actor.claim && actor.by && actor.by !== "auto" && !conversation.assignedTo
      ? { assignedTo: actor.by, assignedName: actor.byName ?? "", assignedAt: message.at }
      : {};
  await conversations().doc(conversation.id).set(
    {
      lastMessage: preview,
      lastDirection: "out",
      lastAt: message.at,
      lastOutboundAt: message.at,
      unread: 0,
      ...claim,
    },
    { merge: true },
  );
}

export async function sendInstagramText(
  input: { conversation: WhatsAppConversation; text: string } & Actor,
): Promise<WhatsAppMessage> {
  const chunks = splitForInstagram(input.text);
  if (chunks.length === 0) throw Object.assign(new Error("Escribe un mensaje."), { status: 400 });
  const { connection, recipient, humanAgent } = await openChat(input.conversation);

  let last: WhatsAppMessage | null = null;
  for (const text of chunks) {
    const sent = await sendInstagramMessage(connection, recipient, { text }, { humanAgent });
    const at = Date.now();
    last = {
      id: sent.messageId ? messageDocId(sent.messageId) : messages(input.conversation.id).doc().id,
      waId: sent.messageId || undefined,
      direction: "out",
      type: "text",
      text,
      at,
      status: "sent",
      by: input.by,
    };
    await recordOutbound(input.conversation, last, text, input);
  }
  return last!;
}

export async function sendInstagramImage(
  input: { conversation: WhatsAppConversation; bytes: Buffer; mimeType: string; caption?: string } & Actor,
): Promise<WhatsAppMessage> {
  if (!(INSTAGRAM_IMAGE_MIME as readonly string[]).includes(input.mimeType)) {
    throw Object.assign(new Error("Solo JPG o PNG."), { status: 400 });
  }
  if (input.bytes.byteLength > INSTAGRAM_IMAGE_MAX_BYTES) {
    throw Object.assign(new Error("La imagen pesa más de 5 MB."), { status: 400 });
  }
  const { connection, recipient, humanAgent } = await openChat(input.conversation);

  // Meta descarga la imagen desde una URL pública nuestra.
  const stored = await storeOutboundImage({ bytes: input.bytes, mimeType: input.mimeType });
  const sent = await sendInstagramMessage(connection, recipient, imageMessage(stored.url), { humanAgent });
  const message: WhatsAppMessage = {
    id: sent.messageId ? messageDocId(sent.messageId) : messages(input.conversation.id).doc().id,
    waId: sent.messageId || undefined,
    direction: "out",
    type: "image",
    text: "",
    at: Date.now(),
    status: "sent",
    mediaPath: stored.path,
    mimeType: input.mimeType,
    by: input.by,
  };
  await recordOutbound(input.conversation, message, "📷 Foto", input);

  // Instagram no tiene pie de foto: el texto sale como mensaje aparte.
  const caption = input.caption?.trim();
  if (caption) await sendInstagramText({ ...input, text: caption });
  return message;
}
