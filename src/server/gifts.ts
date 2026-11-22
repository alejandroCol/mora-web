import { FieldValue } from "firebase-admin/firestore";
import {
  GIFT_MAX_PER_LINE,
  type GiftChat,
  type GiftContext,
  type GiftRecipient,
  type GiftRecord,
  type GiftRequest,
} from "@/commerce/gifts";
import { COLLECTIONS } from "@/commerce/paths";
import {
  availableUnits,
  cartLinesError,
  inventoryLabel,
  lineToOrderItem,
  normalizeCartLine,
} from "@/commerce/sku";
import type { CartLine, InventoryDoc } from "@/commerce/types";
import { channelOf, conversationHandle, conversationTitle } from "@/crm/channel";
import { adminDb } from "@/lib/firebaseAdmin";
import { demandFromItems, inventoryRef, listInventory, seedInventoryIfNeeded } from "./inventory";
import { ensurePricing } from "./pricing";
import { getConversation, listConversations } from "./whatsapp";

function bad(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

function col() {
  return adminDb().collection(COLLECTIONS.gifts);
}

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanItems(raw: CartLine[] | undefined) {
  if (!Array.isArray(raw)) bad("Añade al menos una pieza.");
  const merged = new Map<string, CartLine>();
  for (const line of raw) {
    if (!line || !(line.qty > 0)) continue;
    const normal = normalizeCartLine(line);
    const current = merged.get(normal.key);
    merged.set(normal.key, current ? { ...current, qty: current.qty + normal.qty } : normal);
  }
  const lines = [...merged.values()];
  if (lines.length === 0) bad("Añade al menos una pieza.");
  const invalid = cartLinesError(lines);
  if (invalid) bad(invalid);
  if (lines.some((line) => line.qty > GIFT_MAX_PER_LINE)) {
    bad(`Máximo ${GIFT_MAX_PER_LINE} unidades por referencia en un regalo.`);
  }
  const items = lines.map(lineToOrderItem);
  // Un regalo sale con talla: sin referencia de stock no hay qué descontar.
  if (items.some((item) => !item.sku)) bad("Elige la talla de cada anillo que regalas.");
  return items;
}

async function resolveRecipient(body: GiftRequest): Promise<GiftRecipient> {
  const name = clip(body.name, 80);
  const contact = clip(body.contact, 80);
  const conversationId = clip(body.conversationId, 120);
  if (!conversationId) {
    if (!name) bad("Escribe el nombre de quien recibe el regalo.");
    return { name, ...(contact ? { contact } : {}) };
  }
  const conversation = await getConversation(conversationId);
  if (!conversation) bad("Ese chat ya no existe. Elige otro o escribe el nombre.");
  const handle = contact || conversationHandle(conversation);
  return {
    name: name || conversationTitle(conversation),
    ...(handle ? { contact: handle } : {}),
    conversationId: conversation.id,
    channel: channelOf(conversation),
  };
}

/** Stock libre y chats para armar un regalo. */
export async function giftContext(): Promise<GiftContext> {
  const [inventory, conversations] = await Promise.all([listInventory(), listConversations(300)]);
  const stock: Record<string, number> = {};
  for (const row of inventory) {
    stock[row.sku] = availableUnits(row.units ?? 0, row.reserved ?? 0);
  }
  const chats: GiftChat[] = conversations.map((conversation) => ({
    id: conversation.id,
    title: conversationTitle(conversation),
    handle: conversationHandle(conversation),
    channel: channelOf(conversation),
    creator: conversation.desk === "creators",
  }));
  return { stock, chats };
}

/**
 * Registra el regalo y descuenta el inventario en la misma transacción:
 * o quedan las dos cosas o ninguna.
 */
export async function createGift(
  body: GiftRequest,
  staff: { uid: string; name?: string },
): Promise<GiftRecord> {
  await ensurePricing();
  const items = cleanItems(body.items);
  const recipient = await resolveRecipient(body);
  const note = clip(body.note, 280);
  const demand = demandFromItems(items);

  const db = adminDb();
  await seedInventoryIfNeeded(db);
  const ref = col().doc();
  const now = Date.now();
  const gift: GiftRecord = {
    id: ref.id,
    status: "given",
    recipient,
    items,
    valueCop: items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
    ...(note ? { note } : {}),
    createdAt: now,
    createdBy: staff.uid,
    ...(staff.name ? { createdByName: staff.name } : {}),
  };

  const refs = [...demand.keys()].map((sku) => inventoryRef(db, sku));
  await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map((item) => tx.get(item)));
    snaps.forEach((snap, index) => {
      const sku = refs[index].id;
      const data = snap.data() as InventoryDoc | undefined;
      if (availableUnits(data?.units ?? 0, data?.reserved ?? 0) < (demand.get(sku) ?? 0)) {
        bad(`Sin stock suficiente para ${inventoryLabel(sku)}.`, 409);
      }
    });
    snaps.forEach((snap, index) => {
      const sku = refs[index].id;
      const data = snap.data() as InventoryDoc | undefined;
      tx.set(
        refs[index],
        { sku, units: (data?.units ?? 0) - (demand.get(sku) ?? 0), updatedAt: now },
        { merge: true },
      );
    });
    tx.set(ref, gift);
  });
  return gift;
}

function sortRecent(gifts: GiftRecord[]) {
  return gifts.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listGifts(limit = 300): Promise<GiftRecord[]> {
  const snap = await col().orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((doc) => doc.data() as GiftRecord);
}

/** Regalos ligados a un chat, para la ficha del CRM. */
export async function listGiftsByConversation(conversationId: string): Promise<GiftRecord[]> {
  if (!conversationId) return [];
  const snap = await col().where("recipient.conversationId", "==", conversationId).limit(40).get();
  return sortRecent(snap.docs.map((doc) => doc.data() as GiftRecord));
}

/** Anula un regalo registrado por error: las piezas vuelven al inventario. Una sola vez. */
export async function voidGift(id: string, staff: { uid: string }): Promise<GiftRecord> {
  if (!/^[A-Za-z0-9]{6,40}$/.test(id)) bad("Ese regalo no existe.", 404);
  const db = adminDb();
  const ref = col().doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) bad("Ese regalo no existe.", 404);
    const gift = snap.data() as GiftRecord;
    if (gift.status === "voided") return gift;
    const now = Date.now();
    for (const [sku, qty] of demandFromItems(gift.items)) {
      tx.set(
        inventoryRef(db, sku),
        { units: FieldValue.increment(qty), updatedAt: now },
        { merge: true },
      );
    }
    const patch = { status: "voided" as const, voidedAt: now, voidedBy: staff.uid };
    tx.update(ref, patch);
    return { ...gift, ...patch };
  });
}
