import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/commerce/paths";
import { normalizeText, pickAutomation } from "@/instagram/match";
import {
  AUTOMATION_LIMITS,
  type InstagramAutomation,
  type InstagramAutomationInput,
  type InstagramCommentEvent,
  type InstagramMediaRef,
} from "@/instagram/types";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  InstagramApiError,
  buttonMessage,
  fetchInstagramPermalink,
  replyToInstagramComment,
  sendInstagramMessage,
  type InstagramConnection,
} from "./graph";

/**
 * Automatizaciones de Instagram: alguien comenta una palabra y recibe un DM.
 *
 * Reglas de Meta que mandan en el diseño:
 * - Un solo mensaje privado por comentario, hasta 7 días después.
 * - Solo se puede seguir escribiendo si la persona responde (eso ya es el CRM).
 * - Hay tope de respuestas privadas por hora y por cuenta.
 *
 * Solo se guardan los comentarios que coinciden con una regla: los demás no
 * cuestan ni una escritura.
 */

/** Meta documenta ~750 respuestas privadas por hora por cuenta. Se deja margen. */
export const HOURLY_CAP = 700;
const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RULES_TTL_MS = 20_000;
const MAX_ATTEMPTS = 5;
/** Un envío «en curso» más viejo que esto quedó huérfano (la instancia murió a mitad). */
const STALE_PROCESSING_MS = 10 * 60 * 1000;

/** Hay envíos en cola (lo marca quien difiere uno en esta instancia). */
let deferredHint = false;
let nextDrainAt = 0;

function automations() {
  return adminDb().collection(COLLECTIONS.instagramAutomations);
}

function events() {
  return adminDb().collection(COLLECTIONS.instagramCommentEvents);
}

/** Quién ya recibió el DM de una regla (`oncePerPerson`). */
function recipientRef(automationId: string, igUserId: string) {
  return automations().doc(automationId).collection("recipients").doc(igUserId);
}

function alreadyExists(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 6;
}

function fail(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

// ---------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------

function asAutomation(id: string, data: FirebaseFirestore.DocumentData): InstagramAutomation {
  return {
    id,
    name: String(data.name ?? ""),
    active: data.active !== false,
    scope: data.scope === "media" ? "media" : "all",
    media: Array.isArray(data.media) ? (data.media as InstagramMediaRef[]) : [],
    trigger: data.trigger === "any" ? "any" : "keywords",
    keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
    publicReplies: Array.isArray(data.publicReplies) ? data.publicReplies.map(String) : [],
    dmText: String(data.dmText ?? ""),
    dmButtonLabel: String(data.dmButtonLabel ?? ""),
    dmButtonUrl: String(data.dmButtonUrl ?? ""),
    oncePerPerson: data.oncePerPerson !== false,
    sent: Number(data.sent ?? 0),
    failed: Number(data.failed ?? 0),
    lastSentAt: Number(data.lastSentAt ?? 0),
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
  };
}

function httpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/** Valida y limpia lo que llega del panel. Los mensajes de error los lee quien crea la regla. */
export function sanitizeAutomation(raw: Partial<InstagramAutomationInput>): InstagramAutomationInput {
  const scope = raw.scope === "media" ? "media" : "all";
  const trigger = raw.trigger === "any" ? "any" : "keywords";

  const seen = new Set<string>();
  const keywords = (Array.isArray(raw.keywords) ? raw.keywords : [])
    .map((item) => String(item ?? "").trim().slice(0, AUTOMATION_LIMITS.keyword))
    .filter((item) => {
      const key = normalizeText(item) || item;
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, AUTOMATION_LIMITS.keywords);
  if (trigger === "keywords" && keywords.length === 0) fail("Agrega al menos una palabra clave.");

  const media = (Array.isArray(raw.media) ? raw.media : [])
    .map((item) => ({
      id: String(item?.id ?? "").trim(),
      permalink: httpsUrl(String(item?.permalink ?? "")),
      caption: String(item?.caption ?? "").trim().slice(0, 140),
    }))
    .filter((item) => /^\d{5,40}$/.test(item.id))
    .slice(0, AUTOMATION_LIMITS.media);
  if (scope === "media" && media.length === 0) fail("Elige al menos una publicación.");

  const dmText = String(raw.dmText ?? "").trim();
  if (!dmText) fail("Escribe el mensaje que llega por DM.");

  const dmButtonLabel = String(raw.dmButtonLabel ?? "").trim();
  const rawUrl = String(raw.dmButtonUrl ?? "").trim();
  const dmButtonUrl = rawUrl ? httpsUrl(rawUrl) : "";
  if (rawUrl && !dmButtonUrl) fail("El enlace del botón debe empezar por https://");
  if (Boolean(dmButtonLabel) !== Boolean(dmButtonUrl)) fail("El botón necesita texto y enlace.");
  if (dmButtonLabel.length > AUTOMATION_LIMITS.buttonLabel) {
    fail(`El texto del botón admite hasta ${AUTOMATION_LIMITS.buttonLabel} caracteres.`);
  }
  const dmLimit = dmButtonUrl ? AUTOMATION_LIMITS.dmTextWithButton : AUTOMATION_LIMITS.dmText;
  if (dmText.length > dmLimit) fail(`El mensaje admite hasta ${dmLimit} caracteres.`);

  const publicReplies = (Array.isArray(raw.publicReplies) ? raw.publicReplies : [])
    .map((item) => String(item ?? "").trim().slice(0, AUTOMATION_LIMITS.publicReply))
    .filter(Boolean)
    .slice(0, AUTOMATION_LIMITS.publicReplies);

  const name =
    String(raw.name ?? "").trim().slice(0, AUTOMATION_LIMITS.name) ||
    (trigger === "keywords" ? keywords[0].toUpperCase() : "Cualquier comentario");

  return {
    name,
    active: raw.active !== false,
    scope,
    media: scope === "media" ? media : [],
    trigger,
    keywords: trigger === "keywords" ? keywords : [],
    publicReplies,
    dmText,
    dmButtonLabel,
    dmButtonUrl,
    oncePerPerson: raw.oncePerPerson !== false,
  };
}

let rulesCache: { at: number; rules: InstagramAutomation[] } | null = null;

export async function listAutomations(): Promise<InstagramAutomation[]> {
  const snap = await automations().orderBy("createdAt", "asc").get();
  return snap.docs.map((doc) => asAutomation(doc.id, doc.data()));
}

/**
 * Reglas activas, con caché corta: en un post viral llegan muchos comentarios
 * seguidos y no hace falta leer las reglas en cada uno.
 */
async function activeAutomations() {
  if (rulesCache && Date.now() - rulesCache.at < RULES_TTL_MS) return rulesCache.rules;
  const rules = (await listAutomations()).filter((rule) => rule.active);
  rulesCache = { at: Date.now(), rules };
  return rules;
}

export async function createAutomation(raw: Partial<InstagramAutomationInput>, createdBy: string) {
  const input = sanitizeAutomation(raw);
  const ref = automations().doc();
  const now = Date.now();
  await ref.set({ ...input, sent: 0, failed: 0, lastSentAt: 0, createdAt: now, updatedAt: now, createdBy });
  rulesCache = null;
  return ref.id;
}

export async function updateAutomation(id: string, raw: Partial<InstagramAutomationInput>) {
  const ref = automations().doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Esa regla ya no existe."), { status: 404 });
  // Pausar o activar manda solo `active`: el resto se conserva tal cual.
  const merged = { ...asAutomation(id, snap.data()!), ...raw };
  await ref.set({ ...sanitizeAutomation(merged), updatedAt: Date.now() }, { merge: true });
  rulesCache = null;
}

export async function deleteAutomation(id: string) {
  const ref = automations().doc(id);
  await adminDb().recursiveDelete(ref);
  rulesCache = null;
}

// ---------------------------------------------------------------------------
// Tope por hora
// ---------------------------------------------------------------------------

function hourKey(at = Date.now()) {
  return new Date(at).toISOString().slice(0, 13).replace(/\D/g, "");
}

let hourCache: { key: string; count: number; at: number } | null = null;

/** DMs automáticos enviados en la hora en curso. Se cuenta en Firestore y se recuerda un minuto. */
export async function countSentThisHour() {
  const key = hourKey();
  if (hourCache && hourCache.key === key && Date.now() - hourCache.at < 60_000) return hourCache.count;
  const snap = await events().where("sentHour", "==", key).count().get();
  hourCache = { key, count: snap.data().count, at: Date.now() };
  return hourCache.count;
}

function noteSent() {
  if (hourCache && hourCache.key === hourKey()) hourCache.count += 1;
}

// ---------------------------------------------------------------------------
// Comentario → DM
// ---------------------------------------------------------------------------

/** Forma del aviso `comments` / `live_comments` de Meta. */
export type InstagramCommentChange = {
  id?: string;
  text?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string; original_media_id?: string };
};

export type CommentOutcome = "ignored" | "duplicate" | InstagramCommentEvent["status"];

export async function handleInstagramComment(
  comment: InstagramCommentChange,
  at: number,
  connection: InstagramConnection,
): Promise<CommentOutcome> {
  const fromId = comment.from?.id;
  const text = comment.text?.trim();
  if (!comment.id || !fromId || !text) return "ignored";
  // Nuestra propia respuesta pública también llega como comentario: sin esto, bucle.
  const username = comment.from?.username ?? "";
  if (fromId === connection.accountId || (username && username === connection.username)) return "ignored";

  // En publicaciones promocionadas el comentario llega con otro id; `original_media_id` es el del post.
  const mediaIds = [comment.media?.id, comment.media?.original_media_id].filter(
    (id): id is string => Boolean(id),
  );
  const rule = pickAutomation(await activeAutomations(), { text, mediaIds });
  if (!rule) return "ignored";

  const now = Date.now();
  const event: InstagramCommentEvent = {
    id: comment.id,
    mediaId: comment.media?.original_media_id ?? comment.media?.id ?? "",
    permalink: rule.media.find((item) => mediaIds.includes(item.id))?.permalink || undefined,
    fromId,
    username,
    text: text.slice(0, 500),
    at,
    status: "processing",
    automationId: rule.id,
    automationName: rule.name,
    attempts: 0,
    updatedAt: now,
  };
  const ref = events().doc(event.id);
  try {
    // `create` falla si ya existe: Meta repite avisos y dos instancias pueden recibir el mismo.
    await ref.create(event);
  } catch (error) {
    if (alreadyExists(error)) return "duplicate";
    throw error;
  }
  return deliver(ref, event, rule, connection);
}

/** Reserva a la persona para esta regla. `false` si ya había recibido el DM. */
async function claimRecipient(rule: InstagramAutomation, event: InstagramCommentEvent) {
  if (!rule.oncePerPerson) return true;
  try {
    await recipientRef(rule.id, event.fromId).create({ at: Date.now(), commentId: event.id });
    return true;
  } catch (error) {
    if (!alreadyExists(error)) throw error;
    const holder = await recipientRef(rule.id, event.fromId).get();
    // El mismo comentario reintentando: la reserva es suya.
    return holder.data()?.commentId === event.id;
  }
}

async function deliver(
  ref: DocumentReference,
  event: InstagramCommentEvent,
  rule: InstagramAutomation,
  connection: InstagramConnection,
): Promise<InstagramCommentEvent["status"]> {
  const attempts = event.attempts + 1;
  const close = async (patch: Partial<InstagramCommentEvent>) => {
    await ref.set({ ...patch, attempts, updatedAt: Date.now() }, { merge: true });
    return patch.status!;
  };

  if (Date.now() - event.at > PRIVATE_REPLY_WINDOW_MS) {
    return close({ status: "failed", error: "Pasaron más de 7 días desde el comentario: Meta ya no deja escribirle." });
  }
  if (!(await claimRecipient(rule, event))) {
    return close({ status: "skipped", reason: "already_received" });
  }
  if ((await countSentThisHour()) >= HOURLY_CAP) {
    deferredHint = true;
    return close({ status: "deferred", error: "Tope de mensajes por hora alcanzado. Sale solo cuando haya cupo." });
  }

  let sent: Awaited<ReturnType<typeof sendPrivateReply>>;
  try {
    sent = await sendPrivateReply(connection, event.id, rule);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta no aceptó el mensaje.";
    const retryable = error instanceof InstagramApiError && error.transient && attempts < MAX_ATTEMPTS;
    if (retryable) {
      deferredHint = true;
      return close({ status: "deferred", error: message });
    }
    // Falló de verdad: se libera a la persona para que otro comentario suyo sí reciba el DM.
    await Promise.all([
      rule.oncePerPerson ? recipientRef(rule.id, event.fromId).delete() : null,
      automations().doc(rule.id).set({ failed: FieldValue.increment(1) }, { merge: true }),
    ]).catch(() => undefined);
    return close({ status: "failed", error: message });
  }

  const sentAt = Date.now();
  noteSent();
  await close({
    status: "sent",
    error: "",
    dmText: sent.text,
    messageId: sent.messageId,
    recipientId: sent.recipientId,
    sentAt,
    sentHour: hourKey(sentAt),
  });
  await automations()
    .doc(rule.id)
    .set({ sent: FieldValue.increment(1), lastSentAt: sentAt }, { merge: true })
    .catch(() => undefined);

  // Lo que sigue es cortesía: si falla, el DM ya salió.
  const extras: Partial<InstagramCommentEvent> = {};
  if (rule.publicReplies.length > 0) {
    const reply = rule.publicReplies[Math.floor(Math.random() * rule.publicReplies.length)];
    extras.publicReply = await replyToInstagramComment(connection, event.id, reply).then(
      () => "sent" as const,
      () => "failed" as const,
    );
  }
  if (!event.permalink && event.mediaId) {
    extras.permalink = (await permalinkOf(connection, event.mediaId)) || undefined;
  }
  if (Object.keys(extras).length > 0) await ref.set(extras, { merge: true }).catch(() => undefined);
  return "sent";
}

async function sendPrivateReply(connection: InstagramConnection, commentId: string, rule: InstagramAutomation) {
  const recipient = { comment_id: commentId };
  if (rule.dmButtonLabel && rule.dmButtonUrl) {
    try {
      const result = await sendInstagramMessage(
        connection,
        recipient,
        buttonMessage(rule.dmText, rule.dmButtonLabel, rule.dmButtonUrl),
      );
      return { ...result, text: `${rule.dmText}\n\n${rule.dmButtonLabel}: ${rule.dmButtonUrl}` };
    } catch (error) {
      if (error instanceof InstagramApiError && error.transient) throw error;
      // Meta no aceptó el botón aquí. Como nada salió, el mensaje único sigue disponible:
      // se manda como texto con el enlace adentro.
    }
  }
  const text = rule.dmButtonUrl ? `${rule.dmText}\n\n${rule.dmButtonUrl}` : rule.dmText;
  const result = await sendInstagramMessage(connection, recipient, { text });
  return { ...result, text };
}

const permalinks = new Map<string, string>();

async function permalinkOf(connection: InstagramConnection, mediaId: string) {
  const known = permalinks.get(mediaId);
  if (known !== undefined) return known;
  const permalink = await fetchInstagramPermalink(connection, mediaId).catch(() => "");
  if (permalinks.size > 200) permalinks.clear();
  permalinks.set(mediaId, permalink);
  return permalink;
}

// ---------------------------------------------------------------------------
// Reintentos
// ---------------------------------------------------------------------------

/** Pasa el evento a «en curso» solo si sigue en uno de los estados dados (dos instancias no lo toman a la vez). */
async function claimEvent(ref: DocumentReference, from: InstagramCommentEvent["status"][]) {
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const event = snap.data() as InstagramCommentEvent | undefined;
    if (!event) return null;
    const stale = event.status === "processing" && Date.now() - event.updatedAt > STALE_PROCESSING_MS;
    if (!from.includes(event.status) && !stale) return null;
    tx.update(ref, { status: "processing", updatedAt: Date.now() });
    return event;
  });
}

async function redeliver(ref: DocumentReference, connection: InstagramConnection, from: InstagramCommentEvent["status"][]) {
  const event = await claimEvent(ref, from);
  if (!event) return null;
  const snap = await automations().doc(event.automationId).get();
  if (!snap.exists) {
    await ref.set({ status: "failed", error: "La regla se borró.", updatedAt: Date.now() }, { merge: true });
    return "failed" as const;
  }
  return deliver(ref, event, asAutomation(snap.id, snap.data()!), connection);
}

/** Botón «Reintentar» del historial. */
export async function retryInstagramEvent(id: string, connection: InstagramConnection) {
  const status = await redeliver(events().doc(id), connection, ["failed", "deferred"]);
  if (!status) throw Object.assign(new Error("Ese envío ya salió o se está enviando."), { status: 409 });
  return status;
}

/**
 * Envía lo que quedó en cola. Se llama al final de cada aviso de Meta: mientras
 * haya actividad en la cuenta, la cola avanza sin necesidad de un cron.
 * Sin pistas de cola, solo mira Firestore cada 5 minutos.
 */
export async function drainDeferredEvents(connection: InstagramConnection, limit = 10) {
  const now = Date.now();
  if (!deferredHint && now < nextDrainAt) return 0;
  nextDrainAt = now + 5 * 60_000;
  deferredHint = false;

  if ((await countSentThisHour()) >= HOURLY_CAP) {
    deferredHint = true;
    return 0;
  }
  const [deferred, processing] = await Promise.all([
    events().where("status", "==", "deferred").limit(limit).get(),
    events().where("status", "==", "processing").limit(limit).get(),
  ]);
  const stale = processing.docs.filter(
    (doc) => now - Number(doc.data().updatedAt ?? 0) > STALE_PROCESSING_MS,
  );
  let sent = 0;
  for (const doc of [...deferred.docs, ...stale].slice(0, limit)) {
    const status = await redeliver(doc.ref, connection, ["deferred"]).catch(() => null);
    if (status === "sent") sent += 1;
    if (status === "deferred") break;
  }
  if (deferred.size >= limit) deferredHint = true;
  return sent;
}

// ---------------------------------------------------------------------------
// Lecturas para el panel y el CRM
// ---------------------------------------------------------------------------

export async function listInstagramEvents(limit = 100): Promise<InstagramCommentEvent[]> {
  const snap = await events().orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((doc) => doc.data() as InstagramCommentEvent);
}

/**
 * El DM automático más reciente que recibió esta persona. Cuando responde y
 * aparece en el CRM, así se sabe qué comentó y qué se le mandó.
 */
export async function findCommentOrigin(igUserId: string): Promise<InstagramCommentEvent | null> {
  for (const field of ["recipientId", "fromId"] as const) {
    const snap = await events().where(field, "==", igUserId).limit(10).get();
    const sent = snap.docs
      .map((doc) => doc.data() as InstagramCommentEvent)
      .filter((event) => event.status === "sent")
      .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0));
    if (sent[0]) return sent[0];
  }
  return null;
}
