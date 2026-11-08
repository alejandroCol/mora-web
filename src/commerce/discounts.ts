import { formatMoney } from "@/lib/catalog";
import type { CartOfferKind } from "./types";

/**
 * Códigos de descuento del super admin (Operación › Descuentos).
 * Distintos de las ofertas de carrito abandonado (`MORA-XXXX`), que viven en
 * `abandonedCarts` y se generan solas. Ambos se escriben en el mismo campo del checkout.
 */
export type DiscountCode = {
  /** Mayúsculas, sin espacios. Es el id del documento. */
  code: string;
  kind: CartOfferKind;
  /** Porcentaje 1–100 o pesos enteros. */
  value: number;
  /** null = sin límite. */
  maxUses: number | null;
  /** Pedidos pagados con el código. */
  uses: number;
  /** Pedidos en checkout (aún sin pagar) con el código. Cuentan contra el límite. */
  pending: number;
  active: boolean;
  note?: string;
  createdAt: number;
  createdBy?: string;
  updatedAt: number;
};

export type DiscountCodeStatus = "active" | "paused" | "exhausted";

export const DISCOUNT_CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,19}$/;
/** Reservado para las ofertas de carrito abandonado. */
export const RECOVERY_CODE_RE = /^MORA-[A-Z0-9]{4,8}$/;

export const DISCOUNT_PERCENT_MIN = 1;
export const DISCOUNT_PERCENT_MAX = 100;
export const DISCOUNT_AMOUNT_MIN_COP = 1_000;

export function normalizeDiscountCode(raw: string | null | undefined) {
  return (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function isDiscountCodeFormat(code: string) {
  return DISCOUNT_CODE_RE.test(code);
}

export function isRecoveryCode(code: string) {
  return RECOVERY_CODE_RE.test(code);
}

export function discountCodeRemaining(code: Pick<DiscountCode, "maxUses" | "uses" | "pending">) {
  if (code.maxUses == null) return null;
  return Math.max(0, code.maxUses - code.uses - code.pending);
}

export function discountCodeStatus(code: DiscountCode): DiscountCodeStatus {
  if (!code.active) return "paused";
  const left = discountCodeRemaining(code);
  if (left != null && left <= 0) return "exhausted";
  return "active";
}

export function discountCodeAvailable(code: DiscountCode) {
  return discountCodeStatus(code) === "active";
}

export function discountValueLabel(code: Pick<DiscountCode, "kind" | "value">) {
  return code.kind === "percent" ? `${code.value} %` : `−${formatMoney(code.value)}`;
}

export const DISCOUNT_STATUS_LABEL: Record<DiscountCodeStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  exhausted: "Agotado",
};

/** Enlace que aplica el código al entrar al checkout. */
export function discountCheckoutPath(code: string) {
  return `/checkout?oferta=${encodeURIComponent(code)}`;
}
