/** Preventa inaugural. El super admin puede reactivar este flujo con otra fecha. */

export const SALES_TZ = "America/Bogota";
export const PRESALE_DEFAULT_SALE_ON = "2026-11-20";

export function parseSaleOn(saleOn: string) {
  return new Date(`${saleOn}T09:00:00-05:00`);
}

export function formatSaleLabel(saleOn: string, style: "short" | "full") {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: SALES_TZ,
    day: "numeric",
    month: "long",
    year: style === "full" ? "numeric" : undefined,
  }).format(parseSaleOn(saleOn));
}

export function buildPresaleCopy(saleOn: string) {
  const delivery = parseSaleOn(saleOn);
  const deliveryLabel = formatSaleLabel(saleOn, "short");
  const deliveryFull = formatSaleLabel(saleOn, "full");
  return {
    label: "Preventa",
    kicker: "Edición inaugural",
    delivery,
    deliveryLabel,
    deliveryFull,
    whisper: "Reserva Pro o Ultra ahora. El anillo sale ese día.",
    promise: `Tu Mora se entrega el ${deliveryLabel}.`,
    kitPromise: "Primero el medidor. Después, con tu pedido, pedís la talla.",
    saleOn,
  };
}

/** Fallback estático. La tienda lee la política de ventas, no este objeto. */
export const PRESALE = buildPresaleCopy(PRESALE_DEFAULT_SALE_ON);

export const SIZE_GUIDE_VIDEO = {
  src: "/videos/medir-talla.mp4",
  poster: "/videos/medir-talla.jpg",
  caption: "Cómo medir mi talla",
  whisper: "Un hilo. Un dedo. Tu número.",
} as const;

export function presaleRemaining(saleAt = PRESALE.delivery.getTime(), now = Date.now()) {
  return Math.max(0, saleAt - now);
}

export function isPresaleOpen(saleAt = PRESALE.delivery.getTime(), now = Date.now()) {
  return now < saleAt;
}
