import { CASE_PRODUCT, caseColors, isCaseColorId, type CaseColorId } from "@/lib/cases";
import { products, type ModelId } from "@/lib/catalog";

/**
 * Precios vivos de la tienda. El catálogo (`products`, `CASE_PRODUCT`) trae el precio
 * de fábrica; el super admin puede cambiarlo desde Inventario y queda en
 * `settings/pricing`. `applyPricing` escribe el precio vivo en el catálogo compartido,
 * así todo lo que lee `products[x].price` o `CASE_PRODUCT.price` ve el mismo número.
 */
export type PricingKey = ModelId | "case";

/** Nombre que ve el cliente para cada color de Case. Siempre completo: lo que no se cambió trae el de fábrica. */
export type CaseNames = Record<CaseColorId, string>;

export type Pricing = Record<PricingKey, number> & { updatedAt: number; caseNames: CaseNames };

export const CASE_NAME_MAX = 24;

export const PRICING_KEYS: PricingKey[] = ["aero", "titan", "case"];

export const PRICE_MIN_COP = 1_000;
export const PRICE_MAX_COP = 50_000_000;

const FACTORY: Record<PricingKey, number> = {
  aero: products.aero.price,
  titan: products.titan.price,
  case: CASE_PRODUCT.price,
};

const CASE_IDS = Object.keys(caseColors) as CaseColorId[];

/** Nombres de fábrica, copiados al cargar: `applyPricing` luego escribe encima del catálogo. */
const FACTORY_CASE_NAMES = Object.fromEntries(CASE_IDS.map((id) => [id, caseColors[id].title])) as CaseNames;

export function factoryCaseName(id: CaseColorId) {
  return FACTORY_CASE_NAMES[id];
}

/** Limpia un nombre tecleado. Vacío = volver al de fábrica (null). */
export function cleanCaseName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim().slice(0, CASE_NAME_MAX).trim();
  return text || null;
}

export function normalizeCaseNames(raw: unknown): CaseNames {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    CASE_IDS.map((id) => [id, cleanCaseName(source[id]) ?? FACTORY_CASE_NAMES[id]]),
  ) as CaseNames;
}

export function isCaseNameKey(value: unknown): value is CaseColorId {
  return isCaseColorId(value);
}

export const DEFAULT_PRICING: Pricing = { ...FACTORY, updatedAt: 0, caseNames: { ...FACTORY_CASE_NAMES } };

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
    caseNames: normalizeCaseNames(raw?.caseNames),
  };
}

/** Deja el precio vivo en el catálogo compartido. Idempotente. */
export function applyPricing(pricing: Pricing) {
  products.aero.price = pricing.aero;
  products.titan.price = pricing.titan;
  CASE_PRODUCT.price = pricing.case;
  // Mismo truco para el nombre del color: todo lo que lee `caseColor(id).title` ve el vivo.
  for (const id of CASE_IDS) caseColors[id].title = pricing.caseNames?.[id] || FACTORY_CASE_NAMES[id];
}

export function currentPricing(updatedAt = 0): Pricing {
  return {
    aero: products.aero.price,
    titan: products.titan.price,
    case: CASE_PRODUCT.price,
    updatedAt,
    caseNames: Object.fromEntries(CASE_IDS.map((id) => [id, caseColors[id].title])) as CaseNames,
  };
}

export function factoryPrice(key: PricingKey) {
  return FACTORY[key];
}
