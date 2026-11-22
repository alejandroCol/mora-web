import { randomBytes } from "node:crypto";
import type { DocumentData } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/commerce/paths";
import { discountOf, subtotalOf } from "@/commerce/cartMath";
import { normalizeCartLine } from "@/commerce/sku";
import type {
  AbandonedCart,
  AbandonedCartStatus,
  CartLine,
  CartOffer,
  CartOfferKind,
  CustomerSnapshot,
  ShippingSnapshot,
} from "@/commerce/types";
import { cartOfferExpired, cleanCartOfferHours } from "@/commerce/types";
import { isCaseColorId } from "@/lib/cases";
import { isModelId, products } from "@/lib/catalog";
import { isCaseLine } from "@/commerce/lines";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendAbandonedOfferEmail, sendAbandonedReminderEmail } from "./email";
import { upsertLead } from "./leads";

const SESSION_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OFFER_RE = /^MORA-[A-Z0-9]{4,8}$/;

function carts() {
  return adminDb().collection(COLLECTIONS.abandonedCarts);
}

export function isCartSessionId(value: string | undefined | null): value is string {
  return Boolean(value && SESSION_RE.test(value));
}

export function isOfferCode(value: string | undefined | null): value is string {
  return Boolean(value && OFFER_RE.test(value.trim().toUpperCase()));
}

function compactStrings<T extends Record<string, unknown>>(input: T) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    out[key] = key === "email" ? trimmed.toLowerCase() : trimmed;
  }
  return out as Partial<T>;
}

export function sanitizeItems(raw: CartLine[]) {
  const items: CartLine[] = [];
  for (const line of raw) {
    if (isCaseLine(line)) {
      if (!isCaseColorId(line.finishId)) continue;
      const qty = Math.min(5, Math.max(1, Math.round(Number(line.qty) || 1)));
      items.push(normalizeCartLine({ ...line, qty }));
      continue;
    }
    if (!isModelId(line.modelId)) continue;
    const product = products[line.modelId];
    if (!product || !product.finishes.includes(line.finishId as typeof product.finishes[number])) continue;
    const qty = Math.min(5, Math.max(1, Math.round(Number(line.qty) || 1)));
    items.push(normalizeCartLine({ ...line, qty }));
  }
  return items;
}

function serialize(id: string, data: DocumentData): AbandonedCart {
  return { id, ...(data as Omit<AbandonedCart, "id">) };
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

export async function getAbandonedCart(sessionId: string) {
  if (!isCartSessionId(sessionId)) return null;
  const snap = await carts().doc(sessionId).get();
  if (!snap.exists) return null;
  return serialize(snap.id, snap.data() ?? {});
}

export async function findAbandonedCartByOffer(code: string) {
  const offerCode = code.trim().toUpperCase();
  if (!isOfferCode(offerCode)) return null;
  const snap = await carts().where("offerCode", "==", offerCode).limit(1).get();
  if (snap.empty) return null;
  return serialize(snap.docs[0].id, snap.docs[0].data());
}

export async function upsertAbandonedCart(input: {
  sessionId: string;
  items: CartLine[];
  customer?: Partial<CustomerSnapshot>;
  shipping?: Partial<ShippingSnapshot>;
}): Promise<AbandonedCart | null> {
  if (!isCartSessionId(input.sessionId)) return null;
  const items = sanitizeItems(input.items ?? []);
  if (items.length === 0) return null;

  const now = Date.now();
  const ref = carts().doc(input.sessionId);
  const existingSnap = await ref.get();
  const existing = existingSnap.exists
    ? serialize(existingSnap.id, existingSnap.data() ?? {})
    : null;
  if (existing?.status === "recovered") return existing;

  const customer = {
    ...(existing?.customer ?? {}),
    ...compactStrings(input.customer ?? {}),
  };
  const shipping = {
    ...(existing?.shipping ?? {}),
    ...compactStrings(input.shipping ?? {}),
  };
  const subtotal = subtotalOf(items);
  const status: AbandonedCartStatus =
    existing?.status === "offered" ? "offered" : "open";
  const offer = existing?.offer
    ? {
        ...existing.offer,
        discountCop: discountOf(subtotal, existing.offer),
      }
    : undefined;

  const next: AbandonedCart = {
    id: input.sessionId,
    sessionId: input.sessionId,
    status,
    items,
    customer,
    shipping,
    subtotal,
    offer,
    offerCode: offer?.code,
    reminder: existing?.reminder,
    recoveredOrderId: existing?.recoveredOrderId,
    recoveredOrderNumber: existing?.recoveredOrderNumber,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await ref.set(withoutUndefined(next as unknown as Record<string, unknown>));
  if (customer.email || customer.phone) {
    await upsertLead({
      source: "checkout",
      name: `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim(),
      email: customer.email,
      phone: customer.phone,
      lastEvent: "AbandonedCheckout",
      status: "interested",
    }).catch(() => undefined);
  }
  return next;
}

export async function listAbandonedCarts(limit = 80) {
  const snap = await carts().orderBy("updatedAt", "desc").limit(limit).get();
  return snap.docs
    .map((doc) => serialize(doc.id, doc.data()))
    .filter((cart) => cart.status === "open" || cart.status === "offered");
}

function newOfferCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(5);
  let code = "MORA-";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

export async function offerAbandonedDiscount(input: {
  sessionId: string;
  kind: CartOfferKind;
  value: number;
  /** Vigencia en horas, de 1 a 720. Sin dato: 24. */
  validHours?: number;
  offeredBy: string;
}) {
  const cart = await getAbandonedCart(input.sessionId);
  if (!cart) throw new Error("Carrito no encontrado.");
  if (cart.status === "recovered") throw new Error("Ese carrito ya se convirtió en pedido.");
  if (cart.status === "dismissed") throw new Error("Ese carrito está archivado.");

  const value =
    input.kind === "percent"
      ? Math.min(50, Math.max(1, Math.round(input.value)))
      : Math.max(1000, Math.round(input.value));
  const discountCop = discountOf(cart.subtotal, { kind: input.kind, value });
  if (discountCop <= 0) throw new Error("El descuento no aplica a este carrito.");

  let code = cart.offer?.code ?? newOfferCode();
  if (!cart.offer?.code) {
    for (let i = 0; i < 4; i += 1) {
      const clash = await findAbandonedCartByOffer(code);
      if (!clash || clash.id === cart.id) break;
      code = newOfferCode();
    }
  }

  const now = Date.now();
  const validHours = cleanCartOfferHours(input.validHours);
  const offer: CartOffer = {
    kind: input.kind,
    value,
    code,
    discountCop,
    offeredAt: now,
    offeredBy: input.offeredBy,
    expiresAt: now + validHours * 60 * 60 * 1000,
  };
  const next: AbandonedCart = {
    ...cart,
    status: "offered",
    offer,
    offerCode: code,
    updatedAt: now,
  };
  await carts()
    .doc(cart.id)
    .set(withoutUndefined(next as unknown as Record<string, unknown>));

  let emailed = false;
  if (cart.customer.email) {
    const sent = await sendAbandonedOfferEmail(next);
    emailed = sent.ok;
  }
  return { cart: next, emailed };
}

/** Un recordatorio cada 12 h como mucho: dos seguidos se sienten insistentes. */
const REMINDER_GAP_MS = 12 * 60 * 60 * 1000;

export async function remindAbandonedCart(sessionId: string, sentBy: string) {
  const cart = await getAbandonedCart(sessionId);
  if (!cart) throw new Error("Carrito no encontrado.");
  if (cart.status === "recovered") throw new Error("Ese carrito ya se convirtió en pedido.");
  if (cart.status === "dismissed") throw new Error("Ese carrito está archivado.");
  if (!cart.customer.email) throw new Error("Este carrito no tiene correo.");
  if (cart.reminder && Date.now() - cart.reminder.sentAt < REMINDER_GAP_MS) {
    throw new Error("Ya le enviaste un recordatorio hace poco. Espera al menos 12 horas.");
  }
  const sent = await sendAbandonedReminderEmail(cart);
  if (!sent.ok) throw new Error("No se pudo enviar el correo. Inténtalo de nuevo.");
  const reminder = { sentAt: Date.now(), sentBy, count: (cart.reminder?.count ?? 0) + 1 };
  await carts().doc(cart.id).set({ reminder }, { merge: true });
  return { ...cart, reminder };
}

/** Lo que el checkout necesita para rearmar el carrito desde el enlace del correo: solo los productos. */
export async function resumableCartItems(sessionId: string) {
  const cart = await getAbandonedCart(sessionId);
  if (!cart || cart.status === "recovered" || cart.status === "dismissed") return null;
  return sanitizeItems(cart.items);
}

export async function dismissAbandonedCart(sessionId: string) {
  const cart = await getAbandonedCart(sessionId);
  if (!cart) throw new Error("Carrito no encontrado.");
  if (cart.status === "recovered") return cart;
  const next: AbandonedCart = {
    ...cart,
    status: "dismissed",
    updatedAt: Date.now(),
  };
  await carts()
    .doc(cart.id)
    .set(withoutUndefined(next as unknown as Record<string, unknown>));
  return next;
}

export async function resolveCheckoutOffer(input: {
  sessionId?: string;
  code?: string;
  email?: string;
}) {
  const code = input.code?.trim().toUpperCase();
  let cart: AbandonedCart | null = null;
  if (code) cart = await findAbandonedCartByOffer(code);
  if (!cart && input.sessionId) cart = await getAbandonedCart(input.sessionId);
  if (!cart?.offer) return null;
  if (cart.status === "recovered" || cart.status === "dismissed") return null;
  if (cartOfferExpired(cart.offer)) return null;

  const email = input.email?.trim().toLowerCase();
  if (code && email && cart.customer.email && cart.customer.email !== email) {
    if (input.sessionId !== cart.sessionId) return null;
  }
  return cart;
}

export async function markCartRecovered(input: {
  sessionId?: string;
  offerCode?: string;
  email?: string;
  orderId: string;
  orderNumber: string;
}) {
  const cart = await resolveCheckoutOffer({
    sessionId: input.sessionId,
    code: input.offerCode,
    email: input.email,
  }).catch(() => null);
  const fallback =
    cart ??
    (input.sessionId ? await getAbandonedCart(input.sessionId) : null);
  if (!fallback) return null;
  const now = Date.now();
  const next: AbandonedCart = {
    ...fallback,
    status: "recovered",
    recoveredOrderId: input.orderId,
    recoveredOrderNumber: input.orderNumber,
    updatedAt: now,
  };
  await carts()
    .doc(fallback.id)
    .set(withoutUndefined(next as unknown as Record<string, unknown>));
  return next;
}
