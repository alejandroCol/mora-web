import { randomBytes } from "node:crypto";
import { COLLECTIONS } from "@/commerce/paths";
import type { CartLine } from "@/commerce/types";
import { siteUrl } from "@/lib/site";
import { adminDb } from "@/lib/firebaseAdmin";
import { sanitizeItems } from "./abandonedCarts";

/** 90 días: un regalo se mira más de una vez. */
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_LINES = 12;

/** Sin 0, O, 1 ni I, para que se pueda leer en voz alta. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  const bytes = randomBytes(6);
  let code = "";
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

function isShareCode(value: string) {
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(value);
}

function col() {
  return adminDb().collection(COLLECTIONS.sharedCarts);
}

/** Congela los productos de ahora. Quien abra el enlace ve esto, no un carrito que sigue cambiando. */
export async function createSharedCart(raw: CartLine[]) {
  const items = sanitizeItems(Array.isArray(raw) ? raw : []).slice(0, MAX_LINES);
  if (items.length === 0) {
    throw Object.assign(new Error("No hay nada para compartir."), { status: 400 });
  }
  const now = Date.now();
  let code = newCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const ref = col().doc(code);
    try {
      await ref.create({ items, createdAt: now, expiresAt: now + TTL_MS });
      return { code, url: siteUrl(`/c/${code}`) };
    } catch (error) {
      const codeOf = error instanceof Error && "code" in error ? error.code : undefined;
      const clash = codeOf === 6 || codeOf === "already-exists";
      if (!clash || attempt === 3) throw error;
      code = newCode();
    }
  }
  throw new Error("No se pudo crear el enlace.");
}

/** Solo los productos. Caducado o inexistente: null. */
export async function getSharedCart(raw: string) {
  const code = raw.trim().toUpperCase();
  if (!isShareCode(code)) return null;
  const snap = await col().doc(code).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (typeof data.expiresAt === "number" && data.expiresAt <= Date.now()) return null;
  const items = sanitizeItems((data.items ?? []) as CartLine[]);
  if (items.length === 0) return null;
  return { code, items };
}
