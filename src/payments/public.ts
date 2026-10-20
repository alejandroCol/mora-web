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
