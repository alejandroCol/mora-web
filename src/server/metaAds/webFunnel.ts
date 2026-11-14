import { COLLECTIONS } from "@/commerce/paths";
import { adminDb } from "@/lib/firebaseAdmin";
import { graphOne } from "./graph";

const DAY = 86_400_000;
/** Eventos que Meta deja de recibir cuando marca la cuenta como salud y bienestar. */
const LOWER_FUNNEL = ["AddToCart", "InitiateCheckout", "AddPaymentInfo", "Purchase"];

/** Personas distintas por paso, contadas por Mora (no depende de Meta). */
export type WebFunnel = {
  visitors: number;
  product: number;
  cart: number;
  checkout: number;
  pay: number;
  purchase: number;
};

type DailyDoc = { date?: string; visitors?: number; funnel?: Record<string, { visitors?: number }> };

function bogotaDay(ms: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(ms));
}

export async function loadWebFunnel(days: number, now = Date.now()): Promise<WebFunnel> {
  const snap = await adminDb()
    .collection(COLLECTIONS.insightsDaily)
    .where("date", ">=", bogotaDay(now - (days - 1) * DAY))
    .get();
  const out: WebFunnel = { visitors: 0, product: 0, cart: 0, checkout: 0, pay: 0, purchase: 0 };
  for (const doc of snap.docs) {
    const day = doc.data() as DailyDoc;
    const step = (key: string) => day.funnel?.[key]?.visitors ?? 0;
    out.visitors += day.visitors ?? 0;
    out.product += step("product");
    out.cart += step("cart");
    out.checkout += step("checkout");
    out.pay += step("pay");
    out.purchase += step("purchase");
  }
  return out;
}

/**
 * Meta bloquea en silencio carrito, pago y compra cuando clasifica la cuenta como
 * salud y bienestar (el Pixel avisa «restricted event … suppressed» en la consola).
 * Se nota así: en 30 días Mora vio carritos y el Pixel no recibió ninguno de esos eventos.
 */
export async function detectPixelRestriction(
  pixelId: string,
  token: string,
  monthFunnel: WebFunnel,
  now = Date.now(),
): Promise<boolean> {
  if (!pixelId || !token || monthFunnel.cart < 3) return false;
  const stats = await graphOne<{ data?: { data?: { value?: string; count?: number }[] }[] }>(
    `${pixelId}/stats`,
    { aggregation: "event", start_time: Math.floor((now - 30 * DAY) / 1000) },
    token,
  ).catch(() => null);
  if (!stats) return false;
  const seen = new Set<string>();
  for (const bucket of stats.data ?? []) {
    for (const row of bucket.data ?? []) if (row.value && (row.count ?? 0) > 0) seen.add(row.value);
  }
  return !LOWER_FUNNEL.some((name) => seen.has(name));
}
