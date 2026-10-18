/** Tarifas Meta WhatsApp Business Platform · Colombia (USD por mensaje entregado). */
export type WhatsAppBillCategory =
  | "marketing"
  | "utility"
  | "authentication"
  | "service"
  | "free_ctwa";

export const WHATSAPP_PRICING_DOC =
  "https://developers.facebook.com/docs/whatsapp/pricing";

export const WHATSAPP_MARKET = "CO" as const;

/** Referencia visual en COP; no es factura Meta. */
export const WHATSAPP_COP_PER_USD = 3_210;

/** Desde 1 oct 2026: servicio deja de ser ilimitado gratis; 1.000/mes por número. */
export const SERVICE_FREE_TIER_START_MS = Date.UTC(2026, 9, 1, 5, 0, 0); // 00:00 Bogotá
export const SERVICE_FREE_MESSAGES_PER_MONTH = 1_000;

/** Ventana gratuita click-to-WhatsApp (referral). */
export const CTWA_FREE_WINDOW_MS = 72 * 60 * 60 * 1000;

export const WINDOW_MS = 24 * 60 * 60 * 1000;

/** USD por mensaje entregado · Colombia · Q4 2026 (tabla pública Meta). */
export const WHATSAPP_RATES_USD: Record<
  Exclude<WhatsAppBillCategory, "free_ctwa" | "free_inbound">,
  number
> = {
  marketing: 0.0125,
  utility: 0.0008,
  authentication: 0.0008,
  service: 0.0008,
};

export function monthRangeBogota(at = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(at);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const start = new Date(`${year}-${month}-01T00:00:00-05:00`).getTime();
  const y = Number(year);
  const m = Number(month);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const end = new Date(
    `${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00-05:00`,
  ).getTime();
  return {
    key: `${year}-${month}`,
    label: new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      month: "long",
      year: "numeric",
    }).format(at),
    start,
    end,
  };
}

export function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

export function formatCop(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}
