/** Constantes de Addi que el cliente puede leer. Sin secretos. */

export const ADDI_WIDGET_SRC = "https://s3.amazonaws.com/widgets.addi.com/bundle.min.js";
export const ADDI_MIN_COP_DEFAULT = 50_000;
export const ADDI_MAX_COP_DEFAULT = 3_000_000;

export function addiAllySlug() {
  return process.env.NEXT_PUBLIC_ADDI_ALLY_SLUG?.trim() ?? "";
}

export function addiWidgetEnabled() {
  return Boolean(addiAllySlug());
}

export function addiAmountAllowed(
  amountCop: number,
  minCop = ADDI_MIN_COP_DEFAULT,
  maxCop = ADDI_MAX_COP_DEFAULT,
) {
  const amount = Math.round(amountCop);
  return amount >= minCop && amount <= maxCop;
}

export function checkoutHref(pay?: "addi") {
  return pay === "addi" ? "/checkout?pago=addi" : "/checkout";
}

export function checkoutPrefersAddi(search: string) {
  return new URLSearchParams(search).get("pago") === "addi";
}

/** Últimos 10 dígitos; si viene +57, los descarta. */
export function colombianMobileDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length >= 12) return digits.slice(-10);
  return digits.slice(-10);
}

export function isColombianMobilePhone(phone: string) {
  return /^3\d{9}$/.test(colombianMobileDigits(phone));
}
