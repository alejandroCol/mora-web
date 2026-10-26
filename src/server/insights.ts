import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/commerce/paths";
import type { MoraOrder } from "@/commerce/types";
import {
  finishLabel,
  products,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  CASE_OFFER_ACTIONS,
  FUNNEL_COPY,
  FUNNEL_STEPS,
  type CaseOfferAction,
  type FunnelStep,
  type InsightAdvice,
  type InsightCaseOffer,
  type InsightEvent,
  type InsightFunnelRow,
  type InsightImageKind,
  type InsightImageRow,
  type InsightProductRow,
  type InsightsReport,
} from "@/insights/types";

const MAX_EVENTS = 24;
const ID_RE = /^[a-zA-Z0-9:_-]{1,80}$/;

type DailyDoc = {
  date?: string;
  visitors?: number;
  products?: Record<string, Partial<InsightProductRow> & { name?: string }>;
  images?: Record<
    string,
    Partial<InsightImageRow> & {
      productId?: string;
      productName?: string;
      label?: string;
      src?: string;
      finishId?: string;
      kind?: InsightImageKind;
    }
  >;
  funnel?: Record<string, { events?: number; visitors?: number }>;
  caseOffer?: Record<string, { events?: number; visitors?: number }>;
};

function bogotaDay(ms = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function cleanText(value: unknown, max = 80) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanId(value: unknown) {
  if (typeof value !== "string") return "";
  const next = value.trim();
  return ID_RE.test(next) ? next : "";
}

function cleanSrc(value: unknown) {
  const src = cleanText(value, 400);
  if (!src) return "";
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  if (src.startsWith("https://")) return src;
  return "";
}

function isFunnelStep(value: unknown): value is FunnelStep {
  return FUNNEL_STEPS.includes(value as FunnelStep);
}

function isCaseOfferAction(value: unknown): value is CaseOfferAction {
  return CASE_OFFER_ACTIONS.includes(value as CaseOfferAction);
}

function isModelId(value: string): value is ModelId {
  return value === "aero" || value === "titan";
}

function productNameOf(id: string, fallback?: string) {
  if (isModelId(id)) return products[id].name;
  if (id === "case") return "Case";
  return cleanText(fallback, 40) || id;
}

function imageLabelOf(event: Extract<InsightEvent, { name: "image_view" }>) {
  const given = cleanText(event.label, 60);
  if (given) return given;
  const product = productNameOf(event.productId, event.productName);
  if (event.kind === "ring") return `${product} · anillo 3D`;
  if (event.finishId && isModelId(event.productId)) {
    return `${product} · ${finishLabel(event.productId, event.finishId as FinishId)}`;
  }
  return `${product} · foto`;
}

function normalize(event: InsightEvent | undefined): InsightEvent | null {
  if (!event || typeof event !== "object") return null;
  if (event.name === "funnel") {
    return isFunnelStep(event.step) ? { name: "funnel", step: event.step } : null;
  }
  if (event.name === "case_offer") {
    return isCaseOfferAction(event.action)
      ? { name: "case_offer", action: event.action }
      : null;
  }
  const productId = cleanId(event.productId);
  if (!productId) return null;
  const productName = productNameOf(productId, event.productName);
  if (
    event.name === "product_view" ||
    event.name === "product_cart" ||
    event.name === "product_checkout" ||
    event.name === "product_buy"
  ) {
    return { name: event.name, productId, productName };
  }
  if (event.name !== "image_view") return null;
  const imageId = cleanId(event.imageId);
  if (!imageId) return null;
  const finishId = cleanId(event.finishId) || undefined;
  return {
    name: "image_view",
    productId,
    productName,
    imageId,
    imageSrc: cleanSrc(event.imageSrc) || undefined,
    finishId,
    kind: event.kind === "ring" ? "ring" : "photo",
    label: imageLabelOf({
      ...event,
      productId,
      productName,
      imageId,
      finishId,
      kind: event.kind === "ring" ? "ring" : "photo",
    }),
  };
}

export async function ingestInsights(input: {
  visitorId: string;
  events: InsightEvent[];
}) {
  const visitorId = cleanId(input.visitorId);
  if (!visitorId) return;
  const events = input.events
    .slice(0, MAX_EVENTS)
    .map((event) => normalize(event))
    .filter((event): event is InsightEvent => Boolean(event));
  if (!events.length) return;

  const date = bogotaDay();
  const db = adminDb();
  const dailyRef = db.collection(COLLECTIONS.insightsDaily).doc(date);
  const seenRef = db.collection(COLLECTIONS.insightsSeen).doc(`${date}_${visitorId}`);

  await db.runTransaction(async (tx) => {
    const seenSnap = await tx.get(seenRef);
    const dailySnap = await tx.get(dailyRef);
    const keys = {
      ...((seenSnap.data()?.keys as Record<string, true> | undefined) ?? {}),
    };
    const patch: Record<string, unknown> = {
      date,
      updatedAt: Date.now(),
    };

    const bump = (key: string, eventPath: string, visitorPath?: string) => {
      patch[eventPath] = FieldValue.increment(1);
      if (visitorPath && !keys[key]) {
        keys[key] = true;
        patch[visitorPath] = FieldValue.increment(1);
      }
    };

    if (!keys.visitor) {
      keys.visitor = true;
      patch.visitors = FieldValue.increment(1);
    }

    for (const event of events) {
      if (event.name === "funnel") {
        bump(
          `funnel:${event.step}`,
          `funnel.${event.step}.events`,
          `funnel.${event.step}.visitors`,
        );
        continue;
      }
      if (event.name === "case_offer") {
        bump(
          `caseOffer:${event.action}`,
          `caseOffer.${event.action}.events`,
          `caseOffer.${event.action}.visitors`,
        );
        continue;
      }

      patch[`products.${event.productId}.id`] = event.productId;
      patch[`products.${event.productId}.name`] = productNameOf(
        event.productId,
        event.productName,
      );

      if (event.name === "product_view") {
        bump(
          `product:${event.productId}`,
          `products.${event.productId}.views`,
          `products.${event.productId}.viewers`,
        );
        continue;
      }
      if (event.name === "product_cart") {
        bump(
          `cart:${event.productId}`,
          `products.${event.productId}.carts`,
          `products.${event.productId}.cartViewers`,
        );
        continue;
      }
      if (event.name === "product_checkout") {
        bump(
          `checkout:${event.productId}`,
          `products.${event.productId}.checkouts`,
          `products.${event.productId}.checkoutViewers`,
        );
        continue;
      }
      if (event.name === "product_buy") {
        bump(
          `buy:${event.productId}`,
          `products.${event.productId}.purchases`,
          `products.${event.productId}.buyers`,
        );
        continue;
      }

      const image = event;
      bump(
        `image:${image.imageId}`,
        `images.${image.imageId}.views`,
        `images.${image.imageId}.viewers`,
      );
      patch[`images.${image.imageId}.id`] = image.imageId;
      patch[`images.${image.imageId}.productId`] = image.productId;
      patch[`images.${image.imageId}.productName`] = productNameOf(
        image.productId,
        image.productName,
      );
      patch[`images.${image.imageId}.label`] = image.label ?? imageLabelOf(image);
      patch[`images.${image.imageId}.kind`] = image.kind ?? "photo";
      if (image.imageSrc) patch[`images.${image.imageId}.src`] = image.imageSrc;
      if (image.finishId) patch[`images.${image.imageId}.finishId`] = image.finishId;
    }

    if (!dailySnap.exists) {
      tx.set(dailyRef, { date, visitors: 0, products: {}, images: {}, funnel: {}, caseOffer: {} });
    }
    tx.update(dailyRef, patch);
    tx.set(
      seenRef,
      { date, visitorId, keys, updatedAt: Date.now() },
      { merge: true },
    );
  });
}

function mergeTree(target: Record<string, unknown>, source: Record<string, unknown>) {
  const out = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const current = out[key];
    if (typeof current === "number" && typeof value === "number") {
      out[key] = current + value;
      continue;
    }
    if (
      current &&
      value &&
      typeof current === "object" &&
      typeof value === "object" &&
      !Array.isArray(current) &&
      !Array.isArray(value)
    ) {
      out[key] = mergeTree(
        current as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }
    out[key] = value;
  }
  return out;
}

function nestDotted(data: Record<string, unknown>) {
  let out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const parts = key.split(".");
    const leaf = parts.reduceRight<unknown>((inner, part) => ({ [part]: inner }), value);
    if (leaf && typeof leaf === "object" && !Array.isArray(leaf)) {
      out = mergeTree(out, leaf as Record<string, unknown>);
    }
  }
  return out;
}

export async function recordInsightsPurchase(order: MoraOrder) {
  if (order.channel !== "online") return;
  const visitorId = cleanId(order.meta?.cartSessionId) || `order-${order.id}`;
  const seen = new Set<string>();
  const buys: InsightEvent[] = [];
  for (const item of order.items) {
    if (seen.has(item.modelId)) continue;
    seen.add(item.modelId);
    buys.push({
      name: "product_buy",
      productId: item.modelId,
      productName: productNameOf(item.modelId, item.name),
    });
  }
  await ingestInsights({
    visitorId,
    events: [{ name: "funnel", step: "purchase" }, ...buys],
  });
}

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function emptyProduct(id: string, name: string): InsightProductRow {
  return {
    id,
    name,
    views: 0,
    viewers: 0,
    carts: 0,
    checkouts: 0,
    purchases: 0,
  };
}

function adviceFor(report: Omit<InsightsReport, "advice">): InsightAdvice[] {
  if (report.visitors === 0) {
    return [
      {
        tone: "empty",
        text: "Aún no hay visitas. En cuanto alguien entre a la tienda, aquí se va llenando solo.",
      },
    ];
  }

  const notes: InsightAdvice[] = [];
  if (report.leak && (report.leak.drop ?? 0) >= 3) {
    notes.push({
      tone: "drop",
      text: `El hueco más grande está en «${report.leak.title}»: se cayeron ${report.leak.drop} personas. Ahí conviene escribir o simplificar el paso.`,
    });
  }
  if (report.topProduct && report.products.length > 1) {
    const other = report.products.find((row) => row.id !== report.topProduct?.id);
    if (other && report.topProduct.viewers > other.viewers) {
      notes.push({
        tone: "product",
        text: `Mora ${report.topProduct.name} es el que más miran (${report.topProduct.viewers} personas). Úsalo primero en WhatsApp y en las campañas.`,
      });
    }
  }
  if (report.topImage && report.topImage.viewers >= 2) {
    notes.push({
      tone: "photo",
      text: `La foto que más se quedan viendo es «${report.topImage.label}». Esa es la que vale la pena mandar.`,
    });
  }
  const offer = report.caseOffer;
  if (offer.shown >= 5 && offer.dismissRate >= 50 && offer.addRate < 12) {
    notes.push({
      tone: "case",
      text: `El aviso del Case se cierra mucho (${offer.dismissed} de ${offer.shown}) y casi nadie lo agrega. Puede estar estorbando al pagar.`,
    });
  } else if (offer.shown >= 5 && offer.addRate >= 18) {
    notes.push({
      tone: "case",
      text: `El Case se está sumando: ${offer.added} de ${offer.shown} lo agregaron al pedido.`,
    });
  } else if (offer.shown >= 5 && offer.payRate < 40 && offer.dismissRate >= 35) {
    notes.push({
      tone: "case",
      text: `Vieron el Case y pocos siguieron a pagar (${offer.paid} de ${offer.shown}). Revisa si el aviso frena el último paso.`,
    });
  }
  if (!notes.length) {
    notes.push({
      tone: "drop",
      text: "Todavía hay poco tráfico para ver un patrón. El reporte se vuelve claro a los pocos días.",
    });
  }
  return notes.slice(0, 3);
}

export async function loadInsights(days = 30): Promise<InsightsReport> {
  const span = Math.min(90, Math.max(1, Math.round(days)));
  const since = bogotaDay(Date.now() - (span - 1) * 24 * 60 * 60 * 1000);
  const snap = await adminDb()
    .collection(COLLECTIONS.insightsDaily)
    .where("date", ">=", since)
    .orderBy("date", "asc")
    .get();

  const productsMap = new Map<string, InsightProductRow>([
    ["aero", emptyProduct("aero", "Pro")],
    ["titan", emptyProduct("titan", "Ultra")],
  ]);
  const imagesMap = new Map<string, InsightImageRow>();
  const funnelMap = new Map<FunnelStep, { events: number; visitors: number }>();
  for (const step of FUNNEL_STEPS) {
    funnelMap.set(step, { events: 0, visitors: 0 });
  }
  const caseOfferMap = new Map<CaseOfferAction, { events: number; visitors: number }>();
  for (const action of CASE_OFFER_ACTIONS) {
    caseOfferMap.set(action, { events: 0, visitors: 0 });
  }
  let visitors = 0;

  for (const doc of snap.docs) {
    const day = nestDotted(doc.data() as Record<string, unknown>) as DailyDoc;
    visitors += Number(day.visitors ?? 0);
    for (const [id, row] of Object.entries(day.products ?? {})) {
      const current = productsMap.get(id) ?? emptyProduct(id, productNameOf(id, row.name));
      current.name = productNameOf(id, row.name || current.name);
      current.views += Number(row.views ?? 0);
      current.viewers += Number(row.viewers ?? 0);
      current.carts += Number(row.carts ?? 0);
      current.checkouts += Number(row.checkouts ?? 0);
      current.purchases += Number(row.purchases ?? 0);
      productsMap.set(id, current);
    }
    for (const [id, row] of Object.entries(day.images ?? {})) {
      const current = imagesMap.get(id) ?? {
        id,
        productId: String(row.productId ?? ""),
        productName: productNameOf(String(row.productId ?? ""), row.productName),
        label: String(row.label ?? "Foto"),
        src: String(row.src ?? ""),
        finishId: row.finishId,
        kind: row.kind === "ring" ? "ring" : "photo",
        views: 0,
        viewers: 0,
      };
      current.views += Number(row.views ?? 0);
      current.viewers += Number(row.viewers ?? 0);
      if (row.src) current.src = String(row.src);
      if (row.label) current.label = String(row.label);
      if (row.productName) current.productName = productNameOf(current.productId, row.productName);
      imagesMap.set(id, current);
    }
    for (const step of FUNNEL_STEPS) {
      const row = day.funnel?.[step];
      const current = funnelMap.get(step)!;
      current.events += Number(row?.events ?? 0);
      current.visitors += Number(row?.visitors ?? 0);
    }
    for (const action of CASE_OFFER_ACTIONS) {
      const row = day.caseOffer?.[action];
      const current = caseOfferMap.get(action)!;
      current.events += Number(row?.events ?? 0);
      current.visitors += Number(row?.visitors ?? 0);
    }
  }

  const productRows = [...productsMap.values()]
    .filter((row) => row.views > 0 || row.carts > 0 || row.purchases > 0 || row.id === "aero" || row.id === "titan")
    .sort((a, b) => b.viewers - a.viewers || b.views - a.views);

  const imageRows = [...imagesMap.values()].sort(
    (a, b) => b.viewers - a.viewers || b.views - a.views,
  );

  const funnel: InsightFunnelRow[] = [];
  let leak: InsightFunnelRow | null = null;
  for (let index = 0; index < FUNNEL_STEPS.length; index += 1) {
    const step = FUNNEL_STEPS[index]!;
    const prev = index > 0 ? funnel[index - 1] : null;
    const visitorsHere = funnelMap.get(step)?.visitors ?? 0;
    const eventsHere = funnelMap.get(step)?.events ?? 0;
    const drop =
      prev && prev.visitors > visitorsHere ? prev.visitors - visitorsHere : null;
    const row: InsightFunnelRow = {
      step,
      title: FUNNEL_COPY[step].title,
      hint: FUNNEL_COPY[step].hint,
      visitors: visitorsHere,
      events: eventsHere,
      fromPrevious: prev ? pct(visitorsHere, prev.visitors) : null,
      drop,
      dropShare: prev && drop != null ? pct(drop, prev.visitors) : null,
    };
    funnel.push(row);
    if (drop != null && drop > 0 && (!leak || drop > (leak.drop ?? 0))) {
      leak = row;
    }
  }

  const paid = funnelMap.get("purchase")?.visitors ?? 0;
  const shown = caseOfferMap.get("shown")?.visitors ?? 0;
  const added = caseOfferMap.get("add")?.visitors ?? 0;
  const dismissed = caseOfferMap.get("dismiss")?.visitors ?? 0;
  const offerPaid = caseOfferMap.get("pay")?.visitors ?? 0;
  const caseOffer: InsightCaseOffer = {
    shown,
    added,
    dismissed,
    paid: offerPaid,
    addRate: pct(added, shown),
    dismissRate: pct(dismissed, shown),
    payRate: pct(offerPaid, shown),
  };
  const topProduct =
    productRows.find((row) => row.viewers > 0 || row.views > 0) ?? null;
  const topImage = imageRows[0] && imageRows[0].views > 0 ? imageRows[0] : null;
  const draft: Omit<InsightsReport, "advice"> = {
    days: span,
    visitors,
    conversion: pct(paid, visitors),
    products: productRows,
    images: imageRows.slice(0, 12),
    funnel,
    leak,
    topProduct,
    topImage,
    caseOffer,
  };

  return { ...draft, advice: adviceFor(draft) };
}
