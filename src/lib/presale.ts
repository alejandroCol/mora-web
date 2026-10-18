/** Preventa inaugural. Entrega única del anillo: 20 de noviembre de 2026. */
export const PRESALE = {
  label: "Preventa",
  kicker: "Edición inaugural",
  delivery: new Date("2026-11-20T09:00:00-05:00"),
  deliveryLabel: "20 de noviembre",
  deliveryFull: "20 de noviembre de 2026",
  whisper: "Reserva Pro o Ultra ahora. El anillo sale ese día.",
  promise: "Tu Mora se entrega el 20 de noviembre.",
  kitPromise: "Primero el medidor. Después, con tu pedido, pedís la talla.",
} as const;

export const SIZE_GUIDE_VIDEO = {
  src: "/videos/medir-talla.mp4",
  caption: "Cómo medir tu talla",
  whisper: "Un hilo. Un dedo. Tu número.",
} as const;

export function presaleRemaining(now = Date.now()) {
  return Math.max(0, PRESALE.delivery.getTime() - now);
}

export function isPresaleOpen(now = Date.now()) {
  return now < PRESALE.delivery.getTime();
}
