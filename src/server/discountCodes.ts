import type { DocumentData, DocumentReference, Transaction } from "firebase-admin/firestore";
import {
  DISCOUNT_AMOUNT_MIN_COP,
  DISCOUNT_PERCENT_MAX,
  DISCOUNT_PERCENT_MIN,
  discountCodeAvailable,
  discountCodeRemaining,
  isDiscountCodeFormat,
  isRecoveryCode,
  normalizeDiscountCode,
  type DiscountCode,
} from "@/commerce/discounts";
import { COLLECTIONS } from "@/commerce/paths";
import type { CartOfferKind } from "@/commerce/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { resolveCheckoutOffer } from "./abandonedCarts";

function col() {
  return adminDb().collection(COLLECTIONS.discountCodes);
}

function fail(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

function asCode(id: string, data: DocumentData | undefined): DiscountCode {
  return {
    code: id,
    kind: data?.kind === "amount" ? "amount" : "percent",
    value: Number(data?.value ?? 0),
    maxUses:
      typeof data?.maxUses === "number" && Number.isFinite(data.maxUses)
        ? Math.max(0, Math.round(data.maxUses))
        : null,
    uses: Math.max(0, Math.round(Number(data?.uses ?? 0))),
    pending: Math.max(0, Math.round(Number(data?.pending ?? 0))),
    active: data?.active !== false,
    note: typeof data?.note === "string" && data.note.trim() ? data.note.trim() : undefined,
    createdAt: Number(data?.createdAt ?? 0),
    createdBy: typeof data?.createdBy === "string" ? data.createdBy : undefined,
    updatedAt: Number(data?.updatedAt ?? data?.createdAt ?? 0),
  };
}

function cleanValue(kind: CartOfferKind, raw: unknown) {
  const n = typeof raw === "string" ? Number(raw.replace(/[^\d]/g, "")) : Number(raw);
  if (!Number.isFinite(n)) throw fail("Indica el valor del descuento.");
  const value = Math.round(n);
  if (kind === "percent") {
    if (value < DISCOUNT_PERCENT_MIN || value > DISCOUNT_PERCENT_MAX) {
      throw fail(`El porcentaje va de ${DISCOUNT_PERCENT_MIN} a ${DISCOUNT_PERCENT_MAX}.`);
    }
    return value;
  }
  if (value < DISCOUNT_AMOUNT_MIN_COP) {
    throw fail(`El descuento en pesos debe ser de al menos ${DISCOUNT_AMOUNT_MIN_COP.toLocaleString("es-CO")} COP.`);
  }
  return value;
}

function cleanMaxUses(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "string" ? Number(raw.replace(/[^\d]/g, "")) : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function cleanNote(raw: unknown) {
  if (typeof raw !== "string") return undefined;
  const note = raw.trim().slice(0, 120);
  return note || undefined;
}

export async function listDiscountCodes(): Promise<DiscountCode[]> {
  const snap = await col().get();
  return snap.docs
    .map((doc) => asCode(doc.id, doc.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getDiscountCode(raw: string): Promise<DiscountCode | null> {
  const code = normalizeDiscountCode(raw);
  if (!isDiscountCodeFormat(code)) return null;
  const snap = await col().doc(code).get();
  return snap.exists ? asCode(snap.id, snap.data()) : null;
}

export async function createDiscountCode(input: {
  code: string;
  kind: CartOfferKind;
  value: unknown;
  maxUses?: unknown;
  note?: unknown;
  createdBy: string;
}): Promise<DiscountCode> {
  const code = normalizeDiscountCode(input.code);
  if (!isDiscountCodeFormat(code)) {
    throw fail("El código lleva de 3 a 20 letras, números o guiones.");
  }
  if (isRecoveryCode(code)) {
    throw fail("Los códigos MORA-XXXX son de carritos recuperados. Elige otro.");
  }
  const kind: CartOfferKind = input.kind === "amount" ? "amount" : "percent";
  const value = cleanValue(kind, input.value);
  const maxUses = cleanMaxUses(input.maxUses);
  const note = cleanNote(input.note);
  const now = Date.now();
  const next: DiscountCode = {
    code,
    kind,
    value,
    maxUses,
    uses: 0,
    pending: 0,
    active: true,
    note,
    createdAt: now,
    createdBy: input.createdBy,
    updatedAt: now,
  };
  const ref = col().doc(code);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) throw fail("Ese código ya existe.", 409);
    tx.set(ref, next);
  });
  return next;
}

export async function updateDiscountCode(
  raw: string,
  patch: { active?: unknown; maxUses?: unknown; note?: unknown },
): Promise<DiscountCode> {
  const code = normalizeDiscountCode(raw);
  const ref = col().doc(code);
  const snap = await ref.get();
  if (!snap.exists) throw fail("Ese código no existe.", 404);
  const current = asCode(snap.id, snap.data());
  const next: DiscountCode = {
    ...current,
    active: typeof patch.active === "boolean" ? patch.active : current.active,
    maxUses: "maxUses" in patch ? cleanMaxUses(patch.maxUses) : current.maxUses,
    note: "note" in patch ? cleanNote(patch.note) : current.note,
    updatedAt: Date.now(),
  };
  await ref.set(next);
  return next;
}

export async function deleteDiscountCode(raw: string) {
  const code = normalizeDiscountCode(raw);
  const ref = col().doc(code);
  const snap = await ref.get();
  if (!snap.exists) throw fail("Ese código no existe.", 404);
  const current = asCode(snap.id, snap.data());
  if (current.pending > 0) {
    throw fail("Hay checkouts abiertos con ese código. Páusalo y bórralo cuando cierren.");
  }
  await ref.delete();
}

export type DiscountLookup =
  | { ok: true; code: DiscountCode }
  | { ok: false; reason: string };

/** Valida un código tecleado por el cliente. Explica por qué no aplica. */
export async function lookupDiscountCode(raw: string): Promise<DiscountLookup> {
  const code = normalizeDiscountCode(raw);
  if (!code) return { ok: false, reason: "Escribe un código." };
  if (!isDiscountCodeFormat(code)) return { ok: false, reason: "Ese código no existe." };
  const found = await getDiscountCode(code);
  if (!found) return { ok: false, reason: "Ese código no existe." };
  if (!found.active) return { ok: false, reason: "Ese código ya no está activo." };
  if (!discountCodeAvailable(found)) return { ok: false, reason: "Ese código ya se agotó." };
  return { ok: true, code: found };
}

/**
 * Lo que el checkout aplica. Primero el código de descuento; si no, la oferta de carrito
 * (`MORA-XXXX` o la de la sesión). Con `reason` cuando el cliente escribió algo que no aplica.
 */
export type CheckoutDiscount =
  | { source: "code"; code: string; kind: CartOfferKind; value: number }
  | { source: "recovery"; code: string; kind: CartOfferKind; value: number; sessionId: string }
  | { source: null; reason?: string };

export async function resolveCheckoutDiscount(input: {
  code?: string | null;
  sessionId?: string;
  email?: string;
}): Promise<CheckoutDiscount> {
  const typed = normalizeDiscountCode(input.code);
  if (typed && !isRecoveryCode(typed)) {
    const lookup = await lookupDiscountCode(typed);
    if (lookup.ok) {
      return {
        source: "code",
        code: lookup.code.code,
        kind: lookup.code.kind,
        value: lookup.code.value,
      };
    }
    // Un código que no es de descuento tampoco es de carrito: avisamos.
    return { source: null, reason: lookup.reason };
  }
  const cart = await resolveCheckoutOffer({
    code: typed || undefined,
    sessionId: input.sessionId,
    email: input.email,
  }).catch(() => null);
  if (cart?.offer) {
    return {
      source: "recovery",
      code: cart.offer.code,
      kind: cart.offer.kind,
      value: cart.offer.value,
      sessionId: cart.sessionId,
    };
  }
  if (typed) return { source: null, reason: "Ese código ya no está disponible." };
  return { source: null };
}

function bump(
  tx: Transaction,
  ref: DocumentReference,
  current: DiscountCode,
  patch: Partial<DiscountCode>,
) {
  tx.set(ref, { ...current, ...patch, updatedAt: Date.now() });
}

/** Aparta un uso mientras el pedido espera pago. Falla si ya no queda cupo. */
export async function holdDiscountCode(raw: string) {
  const code = normalizeDiscountCode(raw);
  const ref = col().doc(code);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw fail("Ese código no existe.");
    const current = asCode(snap.id, snap.data());
    if (!current.active) throw fail("Ese código ya no está activo.");
    const left = discountCodeRemaining(current);
    if (left != null && left <= 0) throw fail("Ese código ya se agotó.");
    bump(tx, ref, current, { pending: current.pending + 1 });
  });
}

/** El pedido se pagó: el uso apartado pasa a definitivo. */
export async function settleDiscountCode(raw: string) {
  const code = normalizeDiscountCode(raw);
  const ref = col().doc(code);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current = asCode(snap.id, snap.data());
    bump(tx, ref, current, {
      pending: Math.max(0, current.pending - 1),
      uses: current.uses + 1,
    });
  });
}

/** El checkout expiró o se canceló sin pagar: devuelve el cupo. */
export async function releaseDiscountCode(raw: string) {
  const code = normalizeDiscountCode(raw);
  const ref = col().doc(code);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current = asCode(snap.id, snap.data());
    bump(tx, ref, current, { pending: Math.max(0, current.pending - 1) });
  });
}
