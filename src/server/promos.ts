import { COLLECTIONS, DOCS } from "@/commerce/paths";
import {
  BLACK_LABELS,
  BLACK_MAX_DAYS,
  BLACK_TEASER_HOURS,
  DEFAULT_PROMO_SETTINGS,
  HORA_LOCA_MAX_SLOTS,
  HORA_LOCA_MINUTES,
  HORA_LOCA_TEASER_MINUTES,
  allPromoWindows,
  isPromoPercent,
  newSlotId,
  normalizePromoSettings,
  openPromoWindows,
  pickPromo,
  slotEndsAt,
  type ActivePromo,
  type BlackLabel,
  type HoraLocaSlot,
  type PromoReport,
  type PromoSettings,
  type PromoWindow,
} from "@/commerce/promos";
import { adminDb } from "@/lib/firebaseAdmin";

/** Memo corto por proceso: la tienda pregunta seguido y la analítica en cada evento. */
const MEMO_TTL_MS = 15_000;
let memo: { settings: PromoSettings; at: number } | null = null;

function fail(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

export async function fetchFreshPromoSettings(): Promise<PromoSettings> {
  try {
    const snap = await adminDb().doc(DOCS.promos).get();
    const settings = normalizePromoSettings(snap.exists ? snap.data() : undefined);
    memo = { settings, at: Date.now() };
    return settings;
  } catch (error) {
    console.error("[promos]", error);
    return memo?.settings ?? DEFAULT_PROMO_SETTINGS;
  }
}

export async function ensurePromoSettings(): Promise<PromoSettings> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.settings;
  return fetchFreshPromoSettings();
}

/** Lo que recibe la tienda: la hora del servidor y las promociones que siguen abiertas. */
export async function publicPromos(): Promise<{ now: number; windows: PromoWindow[] }> {
  const settings = await ensurePromoSettings();
  const now = Date.now();
  return { now, windows: openPromoWindows(settings, now) };
}

/** La promoción en vivo ahora mismo, o null. `graceMs` solo para cobrar (ver PROMO_PAY_GRACE_MS). */
export async function livePromoNow(graceMs = 0): Promise<ActivePromo | null> {
  const settings = await ensurePromoSettings();
  const now = Date.now();
  const promo = pickPromo(openPromoWindows(settings, now, graceMs), now, graceMs);
  return promo?.phase === "live" ? promo : null;
}

type Patch = {
  black?: {
    enabled?: unknown;
    label?: unknown;
    percent?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
    teaserHours?: unknown;
  };
  horaLoca?: {
    enabled?: unknown;
    teaserMinutes?: unknown;
    slots?: unknown;
  };
};

function strictMs(value: unknown, what: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw fail(`Indica ${what}.`);
  return Math.round(n);
}

export async function savePromoSettings(patch: Patch, by?: string): Promise<PromoSettings> {
  const current = await fetchFreshPromoSettings();
  const next: PromoSettings = {
    black: { ...current.black },
    horaLoca: { ...current.horaLoca, slots: [...current.horaLoca.slots] },
    updatedAt: Date.now(),
  };

  if (patch.black) {
    const input = patch.black;
    if (input.label !== undefined) {
      if (!BLACK_LABELS.includes(input.label as BlackLabel)) throw fail("Ese nombre no está en la lista.");
      next.black.label = input.label as BlackLabel;
    }
    if (input.percent !== undefined) {
      if (!isPromoPercent(Number(input.percent))) throw fail("El descuento es de 5 % o de 10 %.");
      next.black.percent = Number(input.percent) as 5 | 10;
    }
    if (input.teaserHours !== undefined) {
      const hours = Number(input.teaserHours);
      if (!BLACK_TEASER_HOURS.includes(hours as (typeof BLACK_TEASER_HOURS)[number])) {
        throw fail("El anuncio previo es de 0, 24, 48 o 72 horas.");
      }
      next.black.teaserHours = hours;
    }
    if (input.startsAt !== undefined) {
      next.black.startsAt = input.startsAt === null ? null : strictMs(input.startsAt, "cuándo empieza");
    }
    if (input.endsAt !== undefined) {
      next.black.endsAt = input.endsAt === null ? null : strictMs(input.endsAt, "cuándo termina");
    }
    if (typeof input.enabled === "boolean") next.black.enabled = input.enabled;

    const { startsAt, endsAt, enabled } = next.black;
    if (startsAt && endsAt) {
      if (endsAt <= startsAt) throw fail("El final va después del inicio.");
      if (endsAt - startsAt > BLACK_MAX_DAYS * 86_400_000) {
        throw fail(`La promoción dura máximo ${BLACK_MAX_DAYS} días.`);
      }
    }
    if (enabled) {
      if (!startsAt || !endsAt) throw fail("Pon el inicio y el final antes de encenderla.");
      if (endsAt <= Date.now()) throw fail("Ese final ya pasó. Mueve la fecha antes de encenderla.");
    }
  }

  if (patch.horaLoca) {
    const input = patch.horaLoca;
    if (input.teaserMinutes !== undefined) {
      const minutes = Number(input.teaserMinutes);
      if (!HORA_LOCA_TEASER_MINUTES.includes(minutes as (typeof HORA_LOCA_TEASER_MINUTES)[number])) {
        throw fail("El anuncio previo es de 0, 15, 30 o 60 minutos.");
      }
      next.horaLoca.teaserMinutes = minutes;
    }
    if (typeof input.enabled === "boolean") next.horaLoca.enabled = input.enabled;
    if (input.slots !== undefined) {
      if (!Array.isArray(input.slots)) throw fail("Las horas locas llegaron mal.");
      const slots: HoraLocaSlot[] = input.slots.map((item) => {
        const raw = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        const minutes = Number(raw.minutes);
        if (!HORA_LOCA_MINUTES.includes(minutes as (typeof HORA_LOCA_MINUTES)[number])) {
          throw fail("La hora loca dura 30, 60, 90 o 120 minutos.");
        }
        if (!isPromoPercent(Number(raw.percent))) throw fail("El descuento es de 5 % o de 10 %.");
        const id = typeof raw.id === "string" && /^[a-z0-9]{4,16}$/.test(raw.id) ? raw.id : newSlotId();
        return {
          id,
          startsAt: strictMs(raw.startsAt, "a qué hora empieza la hora loca"),
          minutes,
          percent: Number(raw.percent) as 5 | 10,
        };
      });
      slots.sort((a, b) => a.startsAt - b.startsAt);
      for (let index = 1; index < slots.length; index += 1) {
        if (slots[index]!.startsAt < slotEndsAt(slots[index - 1]!)) {
          throw fail("Dos horas locas se cruzan. Deja que una termine antes de la siguiente.");
        }
      }
      if (new Set(slots.map((slot) => slot.id)).size !== slots.length) {
        throw fail("Hay una hora loca repetida.");
      }
      // Se conservan las últimas: las viejas ya viven en los resultados.
      next.horaLoca.slots = slots.slice(-HORA_LOCA_MAX_SLOTS);
    }
  }

  await adminDb()
    .doc(DOCS.promos)
    .set({ ...next, ...(by ? { updatedBy: by } : {}) });
  memo = { settings: next, at: Date.now() };
  return next;
}

/* ── Resultados ── */

type PromoDoc = {
  key?: string;
  kind?: string;
  label?: string;
  percent?: number;
  startsAt?: number;
  endsAt?: number;
  visitors?: number;
  funnel?: Record<string, { events?: number; visitors?: number }>;
  actions?: Record<string, { events?: number; visitors?: number }>;
  orders?: number;
  revenue?: number;
  discountCop?: number;
};

const BASELINE_DAYS = 14;

function isoDay(ms: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function rate(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function pctLabel(value: number) {
  return `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
}

async function baselineBefore(startsAt: number): Promise<PromoReport["baseline"]> {
  const until = isoDay(startsAt);
  const since = isoDay(startsAt - BASELINE_DAYS * 86_400_000);
  const snap = await adminDb()
    .collection(COLLECTIONS.insightsDaily)
    .where("date", ">=", since)
    .where("date", "<", until)
    .get();
  let visitors = 0;
  let orders = 0;
  for (const doc of snap.docs) {
    const day = doc.data() as { visitors?: number; funnel?: { purchase?: { visitors?: number } } };
    visitors += Number(day.visitors ?? 0);
    orders += Number(day.funnel?.purchase?.visitors ?? 0);
  }
  if (snap.empty || visitors === 0) return null;
  return { days: BASELINE_DAYS, visitors, orders, conversion: rate(orders, visitors) };
}

function verdictOf(report: Omit<PromoReport, "verdict">) {
  if (report.visitors === 0) return "Todavía no entró nadie con la promoción en vivo.";
  const during = `${report.orders} ${report.orders === 1 ? "pedido" : "pedidos"} de ${report.visitors} ${report.visitors === 1 ? "persona" : "personas"} (${pctLabel(report.conversion)})`;
  if (!report.baseline) return `${during}. No hay días previos con visitas para comparar.`;
  const before = pctLabel(report.baseline.conversion);
  if (report.visitors < 30) {
    return `${during}. Antes convertía ${before}. Con menos de 30 personas aún no se puede concluir.`;
  }
  const lift = Math.round((report.conversion - report.baseline.conversion) * 10) / 10;
  if (lift >= 0.5) {
    return `Funcionó: ${during}, frente a ${before} en los ${report.baseline.days} días previos.`;
  }
  if (lift <= -0.5) {
    return `No ayudó: ${during}, por debajo de ${before} en los ${report.baseline.days} días previos.`;
  }
  return `Sin cambio claro: ${during}, casi igual a ${before} de los ${report.baseline.days} días previos.`;
}

/** Una fila por edición que ya empezó, la más reciente primero. */
export async function loadPromoReports(limit = 12): Promise<PromoReport[]> {
  const settings = await ensurePromoSettings();
  const now = Date.now();
  const snap = await adminDb()
    .collection(COLLECTIONS.insightsPromos)
    .orderBy("startsAt", "desc")
    .limit(limit)
    .get();
  const docs = new Map<string, PromoDoc>(snap.docs.map((doc) => [doc.id, doc.data() as PromoDoc]));

  // Las ediciones que ya empezaron salen aunque todavía no tengan visitas.
  const started = allPromoWindows(settings).filter((window) => window.startsAt <= now);
  for (const window of started) {
    if (!docs.has(window.key)) docs.set(window.key, { ...window });
  }

  const rows = await Promise.all(
    [...docs.entries()].map(async ([key, doc]): Promise<PromoReport | null> => {
      const startsAt = Number(doc.startsAt ?? 0);
      const endsAt = Number(doc.endsAt ?? 0);
      if (!startsAt || !endsAt) return null;
      // Las horas vivas mandan sobre las guardadas: el final pudo moverse.
      const window = started.find((item) => item.key === key);
      const end = window?.endsAt ?? endsAt;
      const visitors = Number(doc.visitors ?? 0);
      const orders = Number(doc.orders ?? 0);
      const revenue = Number(doc.revenue ?? 0);
      const draft: Omit<PromoReport, "verdict"> = {
        key,
        kind: doc.kind === "hora_loca" ? "hora_loca" : "black",
        label: window?.label ?? String(doc.label ?? (doc.kind === "hora_loca" ? "Hora Loca" : "Black Friday")),
        percent: Number(window?.percent ?? doc.percent ?? 0),
        startsAt: window?.startsAt ?? startsAt,
        endsAt: end,
        status: end > now ? "live" : "ended",
        visitors,
        sawProduct: Number(doc.funnel?.product?.visitors ?? 0),
        addedToCart: Number(doc.funnel?.cart?.visitors ?? 0),
        startedCheckout: Number(doc.funnel?.checkout?.visitors ?? 0),
        reachedPay: Number(doc.funnel?.pay?.visitors ?? 0),
        orders,
        revenue,
        discountCop: Number(doc.discountCop ?? 0),
        ticket: orders > 0 ? Math.round(revenue / orders) : 0,
        conversion: rate(orders, visitors),
        clicks: Number(doc.actions?.cta?.events ?? 0),
        baseline: await baselineBefore(window?.startsAt ?? startsAt).catch(() => null),
      };
      return { ...draft, verdict: verdictOf(draft) };
    }),
  );

  return rows
    .filter((row): row is PromoReport => Boolean(row))
    .sort((a, b) => b.startsAt - a.startsAt)
    .slice(0, limit);
}
