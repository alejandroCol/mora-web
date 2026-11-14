import { COLLECTIONS } from "@/commerce/paths";
import type { MoraOrder } from "@/commerce/types";
import type { WhatsAppConversation } from "@/growth/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadGrowthSettings } from "./growthSettings";
import { normalizePhone } from "./metaCapi";
import { recordMetaSignal } from "./metaHealth";

const GRAPH = "https://graph.facebook.com/v26.0";

/**
 * Cuenta de WhatsApp Business y su conjunto de datos de conversiones.
 * El id de la cuenta lo trae cada webhook de WhatsApp; el conjunto se crea solo
 * la primera vez. Solo Admin SDK.
 */
const DOC = `${COLLECTIONS.settings}/adsMessaging`;

type MessagingDoc = { wabaId?: string; datasetId?: string };

let cached: MessagingDoc | null = null;

async function loadMessaging(): Promise<MessagingDoc> {
  if (cached?.wabaId && cached.datasetId) return cached;
  const snap = await adminDb().doc(DOC).get();
  cached = snap.exists ? (snap.data() as MessagingDoc) : {};
  return cached;
}

/** El webhook de WhatsApp trae el id de la cuenta en `entry.id`: se guarda una vez. */
export async function rememberWhatsAppAccount(wabaId: string | undefined) {
  if (!wabaId || !/^\d{8,30}$/.test(wabaId)) return;
  const current = await loadMessaging();
  if (current.wabaId === wabaId) return;
  cached = { ...current, wabaId, datasetId: current.wabaId ? "" : current.datasetId };
  await adminDb().doc(DOC).set(cached, { merge: true });
}

type GraphBody = { id?: string; data?: { id?: string }[]; error?: { message?: string; error_user_msg?: string } };

async function graph(method: "GET" | "POST", path: string, token: string, body?: unknown) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as GraphBody;
  const error = !res.ok || data.error ? data.error?.error_user_msg || data.error?.message || `Meta respondió ${res.status}.` : "";
  return { data, error };
}

/** Tokens que pueden tener permiso sobre la cuenta de WhatsApp, del más probable al menos. */
function tokens(settings: Awaited<ReturnType<typeof loadGrowthSettings>>) {
  return [...new Set([settings.whatsappAccessToken, settings.metaAdsToken, settings.metaCapiToken].filter(Boolean))];
}

async function ensureDataset(settings: Awaited<ReturnType<typeof loadGrowthSettings>>) {
  const current = await loadMessaging();
  if (!current.wabaId) return { datasetId: "", error: "Aún no se conoce la cuenta de WhatsApp Business (llega con el próximo mensaje)." };
  if (current.datasetId) return { datasetId: current.datasetId, error: "" };

  let lastError = "Falta el token de WhatsApp.";
  for (const token of tokens(settings)) {
    // POST crea el conjunto de datos de la cuenta o devuelve el que ya existe.
    const { data, error } = await graph("POST", `${current.wabaId}/dataset`, token);
    if (!error && data.id) {
      cached = { ...current, datasetId: data.id };
      await adminDb().doc(DOC).set(cached, { merge: true });
      return { datasetId: data.id, error: "" };
    }
    lastError = error || "Meta no devolvió el conjunto de datos.";
  }
  return { datasetId: "", error: lastError };
}

/**
 * Le cuenta a Meta que un chat que llegó por un anuncio de WhatsApp avanzó o
 * compró. Es lo que deja que el anuncio se optimice por ventas y no solo por chats.
 * https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging
 */
export async function sendMessagingEvent(input: {
  name: "Purchase" | "LeadSubmitted";
  ctwaClid: string;
  at?: number;
  value?: number;
  eventId?: string;
}) {
  const settings = await loadGrowthSettings();
  const { datasetId, error: datasetError } = await ensureDataset(settings);
  if (!datasetId) {
    await recordMetaSignal("messaging", { ok: false, error: datasetError, event: input.name });
    return { ok: false as const, error: datasetError };
  }
  const { wabaId } = await loadMessaging();
  const event: Record<string, unknown> = {
    event_name: input.name,
    event_time: Math.floor((input.at ?? Date.now()) / 1000),
    action_source: "business_messaging",
    messaging_channel: "whatsapp",
    user_data: { whatsapp_business_account_id: wabaId, ctwa_clid: input.ctwaClid },
  };
  if (input.eventId) event.event_id = input.eventId;
  if (input.name === "Purchase") event.custom_data = { currency: "COP", value: Math.round(input.value ?? 0) };

  let lastError = "";
  for (const token of tokens(settings)) {
    const { error } = await graph("POST", `${datasetId}/events`, token, { data: [event], partner_agent: "mora" });
    if (!error) {
      await recordMetaSignal("messaging", { ok: true, event: input.name });
      return { ok: true as const, error: "" };
    }
    lastError = error;
  }
  console.error("[meta messaging]", input.name, lastError);
  await recordMetaSignal("messaging", { ok: false, error: lastError, event: input.name });
  return { ok: false as const, error: lastError };
}

function conversations() {
  return adminDb().collection(COLLECTIONS.whatsappConversations);
}

async function findChat(order: MoraOrder) {
  const ids = [order.conversationId, normalizePhone(order.customer?.phone ?? "")].filter(
    (id): id is string => Boolean(id),
  );
  for (const id of new Set(ids)) {
    const snap = await conversations().doc(id).get();
    if (snap.exists) return { id: snap.id, chat: snap.data() as WhatsAppConversation };
  }
  return null;
}

/**
 * Pedido pagado → el chat de esa persona pasa a «Vendido» con su pedido, y si
 * llegó por un anuncio de WhatsApp, Meta recibe la compra con su valor.
 */
export async function recordChatPurchase(order: MoraOrder) {
  const found = await findChat(order);
  if (!found) return;
  const { id, chat } = found;
  // Una creadora que compra no es una venta de la mesa de ventas.
  if (chat.desk === "creators") return;

  if (!chat.orderId) {
    await conversations()
      .doc(id)
      .set({ status: "sold", orderId: order.id, orderNumber: order.orderNumber }, { merge: true });
  }

  const clid = chat.referral?.ctwaClid;
  if (!clid || order.meta?.messagingPurchaseSent) return;
  const sent = await sendMessagingEvent({
    name: "Purchase",
    ctwaClid: clid,
    at: order.paidAt,
    value: order.totals.total,
    eventId: `purchase-${order.id}`,
  });
  if (sent.ok) {
    await adminDb()
      .collection(COLLECTIONS.orders)
      .doc(order.id)
      .set({ meta: { messagingPurchaseSent: true } }, { merge: true });
  }
}

/**
 * El vendedor marcó el chat como interesado o cotizado: para Meta es un
 * contacto que vale la pena. Una sola vez por chat.
 */
export async function recordChatQualified(chatId: string) {
  const ref = conversations().doc(chatId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const chat = snap.data() as WhatsAppConversation & { metaQualifiedAt?: number };
  const clid = chat.referral?.ctwaClid;
  if (!clid || chat.metaQualifiedAt || chat.desk === "creators") return;
  const sent = await sendMessagingEvent({ name: "LeadSubmitted", ctwaClid: clid, eventId: `lead-${chatId}` });
  if (sent.ok) await ref.set({ metaQualifiedAt: Date.now() }, { merge: true });
}
