import { discountOf } from "./cartMath";

/**
 * Promociones con reloj: Black Friday / Black Week y Hora Loca.
 * El super admin las programa en Operación › Promociones (`settings/promos`).
 * El descuento es un porcentaje sobre el subtotal y se aplica solo: no hay código que escribir.
 * Todas las horas son instantes (ms). El panel las escribe y las lee en hora de Colombia.
 */
export const PROMO_PERCENTS = [5, 10] as const;
export type PromoPercent = (typeof PROMO_PERCENTS)[number];

export const PROMO_KINDS = ["black", "hora_loca"] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

export const BLACK_LABELS = ["Black Friday", "Black Week"] as const;
export type BlackLabel = (typeof BLACK_LABELS)[number];

export const HORA_LOCA_LABEL = "Hora Loca";

export const BLACK_TEASER_HOURS = [0, 24, 48, 72] as const;
export const HORA_LOCA_TEASER_MINUTES = [0, 15, 30, 60] as const;
export const HORA_LOCA_MINUTES = [30, 60, 90, 120] as const;

export const BLACK_MAX_DAYS = 31;
export const HORA_LOCA_MAX_SLOTS = 12;

/** El servidor respeta el precio este rato después del cierre: cubre al que ya estaba pagando. */
export const PROMO_PAY_GRACE_MS = 3 * 60 * 1000;

export type BlackConfig = {
  enabled: boolean;
  label: BlackLabel;
  percent: PromoPercent;
  startsAt: number | null;
  endsAt: number | null;
  /** Horas antes del inicio en que la tienda anuncia «empieza en…». 0 = sin anuncio. */
  teaserHours: number;
};

export type HoraLocaSlot = {
  id: string;
  startsAt: number;
  minutes: number;
  percent: PromoPercent;
};

export type HoraLocaConfig = {
  enabled: boolean;
  /** Minutos antes de cada hora loca en que se anuncia. 0 = sin anuncio. */
  teaserMinutes: number;
  slots: HoraLocaSlot[];
};

export type PromoSettings = {
  black: BlackConfig;
  horaLoca: HoraLocaConfig;
  updatedAt: number;
};

export const DEFAULT_PROMO_SETTINGS: PromoSettings = {
  black: {
    enabled: false,
    label: "Black Friday",
    percent: 10,
    startsAt: null,
    endsAt: null,
    teaserHours: 0,
  },
  horaLoca: { enabled: false, teaserMinutes: 0, slots: [] },
  updatedAt: 0,
};

/** Una promoción con sus horas, tal como la recibe la tienda. */
export type PromoWindow = {
  kind: PromoKind;
  /** Identifica la edición en la analítica: `bw-20261127` o `hl-<id>`. */
  key: string;
  label: string;
  percent: PromoPercent;
  /** Desde cuándo se anuncia. Igual a `startsAt` si no hay anuncio previo. */
  teaserAt: number;
  startsAt: number;
  endsAt: number;
};

export type PromoPhase = "teaser" | "live";

export type ActivePromo = PromoWindow & {
  phase: PromoPhase;
  /** Vista previa local: solo se ve, el servidor no descuenta ni cuenta eventos. */
  preview?: boolean;
};

/** Lo que queda guardado en el pedido que se creó con la promoción en vivo. */
export type OrderPromo = {
  kind: PromoKind;
  key: string;
  label: string;
  percent: PromoPercent;
  startsAt: number;
  endsAt: number;
  /** true si el descuento del pedido fue el de la promoción (y no un código mayor). */
  applied: boolean;
};

export function isPromoPercent(value: unknown): value is PromoPercent {
  return PROMO_PERCENTS.includes(value as PromoPercent);
}

export function isPromoKind(value: unknown): value is PromoKind {
  return PROMO_KINDS.includes(value as PromoKind);
}

function asMs(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function asChoice<T extends number>(value: unknown, options: readonly T[], fallback: T): T {
  const n = Number(value);
  return options.includes(n as T) ? (n as T) : fallback;
}

const SLOT_ID_RE = /^[a-z0-9]{4,16}$/;

export function normalizePromoSettings(raw: unknown): PromoSettings {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const black = (data.black && typeof data.black === "object" ? data.black : {}) as Record<string, unknown>;
  const hora = (data.horaLoca && typeof data.horaLoca === "object" ? data.horaLoca : {}) as Record<string, unknown>;
  const startsAt = asMs(black.startsAt);
  const endsAt = asMs(black.endsAt);
  const validRange = startsAt != null && endsAt != null && endsAt > startsAt;
  const slots = (Array.isArray(hora.slots) ? hora.slots : [])
    .map((item): HoraLocaSlot | null => {
      const slot = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const start = asMs(slot.startsAt);
      const id = typeof slot.id === "string" && SLOT_ID_RE.test(slot.id) ? slot.id : "";
      if (!start || !id) return null;
      return {
        id,
        startsAt: start,
        minutes: asChoice(slot.minutes, HORA_LOCA_MINUTES, 60),
        percent: asChoice(slot.percent, PROMO_PERCENTS, 10),
      };
    })
    .filter((slot): slot is HoraLocaSlot => Boolean(slot))
    .sort((a, b) => a.startsAt - b.startsAt);
  return {
    black: {
      enabled: black.enabled === true && validRange,
      label: BLACK_LABELS.includes(black.label as BlackLabel) ? (black.label as BlackLabel) : "Black Friday",
      percent: asChoice(black.percent, PROMO_PERCENTS, 10),
      startsAt: validRange ? startsAt : null,
      endsAt: validRange ? endsAt : null,
      teaserHours: asChoice(black.teaserHours, BLACK_TEASER_HOURS, 0),
    },
    horaLoca: {
      enabled: hora.enabled === true,
      teaserMinutes: asChoice(hora.teaserMinutes, HORA_LOCA_TEASER_MINUTES, 0),
      slots,
    },
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}

/** Día calendario en Colombia, `YYYYMMDD`. */
export function bogotaDayKey(ms: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(ms))
    .replace(/-/g, "");
}

export function slotEndsAt(slot: Pick<HoraLocaSlot, "startsAt" | "minutes">) {
  return slot.startsAt + slot.minutes * 60_000;
}

/** Todas las promociones encendidas, con sus horas. Incluye las que ya pasaron. */
export function allPromoWindows(settings: PromoSettings): PromoWindow[] {
  const out: PromoWindow[] = [];
  const { black, horaLoca } = settings;
  if (black.enabled && black.startsAt && black.endsAt && black.endsAt > black.startsAt) {
    out.push({
      kind: "black",
      key: `bw-${bogotaDayKey(black.startsAt)}`,
      label: black.label,
      percent: black.percent,
      teaserAt: black.startsAt - black.teaserHours * 3_600_000,
      startsAt: black.startsAt,
      endsAt: black.endsAt,
    });
  }
  if (horaLoca.enabled) {
    for (const slot of horaLoca.slots) {
      out.push({
        kind: "hora_loca",
        key: `hl-${slot.id}`,
        label: HORA_LOCA_LABEL,
        percent: slot.percent,
        teaserAt: slot.startsAt - horaLoca.teaserMinutes * 60_000,
        startsAt: slot.startsAt,
        endsAt: slotEndsAt(slot),
      });
    }
  }
  return out;
}

/** Las que la tienda todavía necesita conocer: en vivo, anunciadas o por venir. */
export function openPromoWindows(settings: PromoSettings, now: number, graceMs = 0) {
  return allPromoWindows(settings).filter((window) => window.endsAt + graceMs > now);
}

/**
 * La promoción que manda en este instante.
 * En vivo gana el mayor descuento; si empatan, la Hora Loca (es la que se acaba primero).
 * Si nada está en vivo, la anunciada que empieza antes.
 */
export function pickPromo(windows: PromoWindow[], now: number, graceMs = 0): ActivePromo | null {
  const live = windows
    .filter((window) => window.startsAt <= now && now < window.endsAt + graceMs)
    .sort(
      (a, b) =>
        b.percent - a.percent ||
        Number(b.kind === "hora_loca") - Number(a.kind === "hora_loca") ||
        a.endsAt - b.endsAt,
    );
  if (live[0]) return { ...live[0], phase: "live" };
  const teaser = windows
    .filter((window) => window.teaserAt <= now && now < window.startsAt)
    .sort((a, b) => a.startsAt - b.startsAt);
  return teaser[0] ? { ...teaser[0], phase: "teaser" } : null;
}

/** El próximo instante en que cambia lo que se ve (empieza el anuncio, empieza o termina algo). */
export function nextPromoBoundary(windows: PromoWindow[], now: number): number | null {
  let next: number | null = null;
  for (const window of windows) {
    for (const at of [window.teaserAt, window.startsAt, window.endsAt]) {
      if (at > now && (next == null || at < next)) next = at;
    }
  }
  return next;
}

export function isPromoLive(promo: ActivePromo | null | undefined): promo is ActivePromo {
  return promo?.phase === "live";
}

/** Descuento de la promoción sobre un subtotal. 0 si no está en vivo. */
export function promoDiscountOf(subtotal: number, promo: ActivePromo | null | undefined) {
  if (!isPromoLive(promo)) return 0;
  return discountOf(subtotal, { kind: "percent", value: promo.percent });
}

/** Precio de una pieza con la promoción en vivo. */
export function promoPriceOf(price: number, promo: ActivePromo | null | undefined) {
  return Math.max(0, price - promoDiscountOf(price, promo));
}

export function promoFigure(promo: Pick<PromoWindow, "percent">) {
  return `−${promo.percent} %`;
}

export function newSlotId() {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/* ── Horas de Colombia para los campos del panel (UTC−5 todo el año) ── */

const BOGOTA_OFFSET_MS = 5 * 3_600_000;

/** Instante → valor de `<input type="datetime-local">` en hora de Colombia. */
export function bogotaInputValue(ms: number | null) {
  if (!ms) return "";
  return new Date(ms - BOGOTA_OFFSET_MS).toISOString().slice(0, 16);
}

/** Valor de `<input type="datetime-local">` (hora de Colombia) → instante. */
export function fromBogotaInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}:00-05:00`);
  return Number.isFinite(ms) ? ms : null;
}

/** «viernes 27 de noviembre, 11:59 p. m.» en hora de Colombia. */
export function promoMoment(ms: number) {
  const day = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(ms)
    .replace(",", "");
  const time = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(ms)
    .replace(/\s+/g, " ");
  return `${day}, ${time}`;
}

/** «8:00 p. m.» en hora de Colombia. */
export function promoClockTime(ms: number) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(ms)
    .replace(/\s+/g, " ");
}

/** El viernes siguiente al cuarto jueves de noviembre, a las 00:00 de Colombia. */
export function blackFridayOf(year: number) {
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const firstThursday = 1 + ((4 - first + 7) % 7);
  const friday = firstThursday + 21 + 1;
  return Date.UTC(year, 10, friday) + BOGOTA_OFFSET_MS;
}

export type PromoReport = {
  key: string;
  kind: PromoKind;
  label: string;
  percent: number;
  startsAt: number;
  endsAt: number;
  status: "live" | "ended";
  /** Personas distintas que pasaron por la tienda con la promoción en vivo. */
  visitors: number;
  sawProduct: number;
  addedToCart: number;
  startedCheckout: number;
  reachedPay: number;
  /** Pedidos pagados que nacieron con la promoción en vivo. */
  orders: number;
  revenue: number;
  discountCop: number;
  ticket: number;
  /** Pedidos ÷ personas, en % con un decimal. */
  conversion: number;
  /** Toques a «Elegir» desde la franja o el escenario de la promoción. */
  clicks: number;
  baseline: {
    days: number;
    visitors: number;
    orders: number;
    conversion: number;
  } | null;
  verdict: string;
};
