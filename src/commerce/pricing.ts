import { CASE_PRODUCT } from "@/lib/cases";
import { products, type ModelId } from "@/lib/catalog";

/**
 * Precios vivos de la tienda. El catálogo (`products`, `CASE_PRODUCT`) trae el precio
 * de fábrica; el super admin puede cambiarlo desde Inventario y queda en
 * `settings/pricing`. `applyPricing` escribe el precio vivo en el catálogo compartido,
 * así todo lo que lee `products[x].price` o `CASE_PRODUCT.price` ve el mismo número.
 */
export type PricingKey = ModelId | "case";

export type Pricing = Record<PricingKey, number> & { updatedAt: number };

export const PRICING_KEYS: PricingKey[] = ["aero", "titan", "case"];

export const PRICE_MIN_COP = 1_000;
export const PRICE_MAX_COP = 50_000_000;

const FACTORY: Record<PricingKey, number> = {
  aero: products.aero.price,
  titan: products.titan.price,
  case: CASE_PRODUCT.price,
};

export const DEFAULT_PRICING: Pricing = { ...FACTORY, updatedAt: 0 };

export const PRICING_LABEL: Record<PricingKey, { name: string; line: string }> = {
  aero: { name: "Mora Pro", line: products.aero.line },
  titan: { name: "Mora Ultra", line: products.titan.line },
  case: { name: "Mora Case", line: CASE_PRODUCT.line },
};

export function isPricingKey(value: unknown): value is PricingKey {
  return value === "aero" || value === "titan" || value === "case";
}

/** Convierte lo que venga (número, "679.000", "$ 679000") a COP enteros o null. */
export function parsePriceCop(value: unknown): number | null {
  const n =
    typeof value === "string" ? Number(value.replace(/[^\d]/g, "")) : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < PRICE_MIN_COP || rounded > PRICE_MAX_COP) return null;
  return rounded;
}

export function normalizePricing(raw: Record<string, unknown> | undefined | null): Pricing {
  return {
    aero: parsePriceCop(raw?.aero) ?? FACTORY.aero,
    titan: parsePriceCop(raw?.titan) ?? FACTORY.titan,
    case: parsePriceCop(raw?.case) ?? FACTORY.case,
    updatedAt: typeof raw?.updatedAt === "number" ? raw.updatedAt : 0,
  };
}

/** Deja el precio vivo en el catálogo compartido. Idempotente. */
export function applyPricing(pricing: Pricing) {
  products.aero.price = pricing.aero;
  products.titan.price = pricing.titan;
  CASE_PRODUCT.price = pricing.case;
}

export function currentPricing(updatedAt = 0): Pricing {
  return {
    aero: products.aero.price,
    titan: products.titan.price,
    case: CASE_PRODUCT.price,
    updatedAt,
  };
}

export function factoryPrice(key: PricingKey) {
  return FACTORY[key];
}
