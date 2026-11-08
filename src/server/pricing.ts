import { cache } from "react";
import { DOCS } from "@/commerce/paths";
import {
  applyPricing,
  DEFAULT_PRICING,
  normalizePricing,
  parsePriceCop,
  PRICE_MAX_COP,
  PRICE_MIN_COP,
  PRICING_KEYS,
  type Pricing,
  type PricingKey,
} from "@/commerce/pricing";
import { adminDb } from "@/lib/firebaseAdmin";

/** Memo corto por proceso: evita una lectura a Firestore por cada cálculo de dinero. */
const MEMO_TTL_MS = 15_000;
let memo: { pricing: Pricing; at: number } | null = null;

function remember(pricing: Pricing) {
  memo = { pricing, at: Date.now() };
  applyPricing(pricing);
  return pricing;
}

export async function fetchFreshPricing(): Promise<Pricing> {
  try {
    const snap = await adminDb().doc(DOCS.pricing).get();
    return remember(normalizePricing(snap.exists ? snap.data() : undefined));
  } catch (error) {
    console.error("[pricing]", error);
    return memo?.pricing ?? DEFAULT_PRICING;
  }
}

/**
 * Lee los precios vivos (memo de 15 s) y los deja aplicados en el catálogo del servidor.
 * Llamar antes de cualquier cálculo de dinero en rutas y páginas.
 */
export async function ensurePricing(): Promise<Pricing> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) {
    applyPricing(memo.pricing);
    return memo.pricing;
  }
  return fetchFreshPricing();
}

/** Una lectura por render en RSC. */
export const loadPricing = cache(ensurePricing);

function strictPrice(key: PricingKey, value: unknown) {
  const price = parsePriceCop(value);
  if (price == null) {
    throw Object.assign(
      new Error(
        `El precio de ${key === "case" ? "Mora Case" : key === "aero" ? "Mora Pro" : "Mora Ultra"} debe estar entre ${PRICE_MIN_COP.toLocaleString("es-CO")} y ${PRICE_MAX_COP.toLocaleString("es-CO")} COP.`,
      ),
      { status: 400 },
    );
  }
  return price;
}

export async function savePricing(
  patch: Partial<Record<PricingKey, unknown>>,
  by?: string,
): Promise<Pricing> {
  const current = await fetchFreshPricing();
  const next: Pricing = { ...current, updatedAt: Date.now() };
  let touched = false;
  for (const key of PRICING_KEYS) {
    if (patch[key] === undefined) continue;
    next[key] = strictPrice(key, patch[key]);
    touched = true;
  }
  if (!touched) {
    throw Object.assign(new Error("Indica el precio a cambiar."), { status: 400 });
  }
  await adminDb()
    .doc(DOCS.pricing)
    .set({ ...next, ...(by ? { updatedBy: by } : {}) }, { merge: true });
  return remember(next);
}
