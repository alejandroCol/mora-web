import { formatAdsMoney, formatCount } from "@/ads/format";
import type {
  AdRow,
  AdsDay,
  AdsMetrics,
  AdsNote,
  AdsOutcome,
  AdsRange,
  AdsReport,
  CampaignRow,
} from "@/ads/types";
import { COLLECTIONS } from "@/commerce/paths";
import type { MoraOrder } from "@/commerce/types";
import type { WhatsAppConversation } from "@/growth/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadGrowthSettings } from "../growthSettings";
import {
  budgetToAmount,
  fetchAdSets,
  fetchAds,
  fetchCampaigns,
  fetchInsights,
  metricsFromRow,
  type MetaAd,
} from "./graph";

const DAY_MS = 86_400_000;
/** Bogotá no tiene horario de verano: siempre UTC−5. */
const BOGOTA_OFFSET = "-05:00";

function bogotaDay(ms = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function dayStart(day: string) {
  return Date.parse(`${day}T00:00:00${BOGOTA_OFFSET}`);
}

export function rangeDays(range: AdsRange, now = Date.now()) {
  const until = bogotaDay(now);
  const back = (days: number) => bogotaDay(dayStart(until) - days * DAY_MS + DAY_MS / 2);
  const since =
    range === "today" ? until : range === "7d" ? back(6) : range === "30d" ? back(29) : `${until.slice(0, 8)}01`;
  return { since, until, startMs: dayStart(since), endMs: dayStart(until) + DAY_MS };
}

function eachDay(since: string, until: string) {
  const days: string[] = [];
  for (let ms = dayStart(since); ms <= dayStart(until); ms += DAY_MS) days.push(bogotaDay(ms + DAY_MS / 2));
  return days;
}

const EMPTY_METRICS: AdsMetrics = {
  spend: 0,
  impressions: 0,
  reach: 0,
  linkClicks: 0,
  chats: 0,
  pixelPurchases: 0,
  pixelRevenue: 0,
  leads: 0,
};

const EMPTY_OUTCOME: AdsOutcome = { crmChats: 0, sales: 0, revenue: 0 };

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa",
  PAUSED: "En pausa",
  CAMPAIGN_PAUSED: "En pausa",
  ADSET_PAUSED: "En pausa",
  IN_PROCESS: "Procesando",
  WITH_ISSUES: "Con problemas",
  PENDING_REVIEW: "En revisión",
  PREAPPROVED: "En revisión",
  DISAPPROVED: "Rechazada",
  PENDING_BILLING_INFO: "Falta el pago",
  ARCHIVED: "Archivada",
  DELETED: "Borrada",
};

const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_ENGAGEMENT: "Interacción y mensajes",
  OUTCOME_SALES: "Ventas",
  OUTCOME_TRAFFIC: "Tráfico a la web",
  OUTCOME_AWARENESS: "Que te conozcan",
  OUTCOME_LEADS: "Clientes potenciales",
  OUTCOME_APP_PROMOTION: "Descargas de la app",
  MESSAGES: "Mensajes",
  CONVERSIONS: "Ventas",
  LINK_CLICKS: "Tráfico a la web",
  REACH: "Alcance",
  BRAND_AWARENESS: "Que te conozcan",
  POST_ENGAGEMENT: "Interacción",
  VIDEO_VIEWS: "Reproducciones",
  LEAD_GENERATION: "Clientes potenciales",
};

function statusLabel(status: string | undefined) {
  return STATUS_LABEL[status ?? ""] ?? "Sin estado";
}

const META_SOURCES = new Set(["facebook", "fb", "instagram", "ig", "meta"]);

function fromMeta(order: MoraOrder) {
  const a = order.attribution;
  if (!a) return false;
  return Boolean(a.fbclid || a.fbc || META_SOURCES.has((a.utmSource ?? "").toLowerCase()));
}

function isPaid(order: MoraOrder | undefined): order is MoraOrder {
  return Boolean(order?.paidAt) && order?.status !== "cancelled";
}

type CrmByAd = Map<string, AdsOutcome>;

/** Últimos 10 dígitos: así cruza «+57 312…» con «312…». */
function phoneKey(phone: string | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

/** Chats de anuncio que entraron al CRM en el periodo y lo que vendieron. */
async function loadCrm(startMs: number, endMs: number) {
  const db = adminDb();
  const snap = await db.collection(COLLECTIONS.whatsappConversations).where("source", "==", "ad").get();
  const chats = snap.docs
    .map((doc) => ({ ...(doc.data() as WhatsAppConversation), id: doc.id }))
    .filter((chat) => {
      const type = chat.referral?.sourceType;
      if (type === "post" || type === "comment") return false;
      const at = chat.referral?.at ?? chat.lastInboundAt ?? chat.lastAt;
      return at >= startMs && at < endMs;
    });

  const paidSnap = await db.collection(COLLECTIONS.orders).where("paidAt", ">=", startMs).get();
  const paidOrders = paidSnap.docs
    .map((doc) => ({ ...(doc.data() as MoraOrder), id: doc.id }))
    .filter((order) => isPaid(order) && (order.paidAt ?? 0) < endMs);

  const orders = new Map<string, MoraOrder>(paidOrders.map((order) => [order.id, order]));
  const missing = [
    ...new Set(chats.map((chat) => chat.orderId).filter((id): id is string => Boolean(id) && !orders.has(id!))),
  ];
  if (missing.length > 0) {
    const refs = missing.map((id) => db.collection(COLLECTIONS.orders).doc(id));
    for (const doc of await db.getAll(...refs)) {
      if (doc.exists) orders.set(doc.id, { ...(doc.data() as MoraOrder), id: doc.id });
    }
  }
  // Quien escribió desde un anuncio y luego pagó en la web sin que nadie ligara el pedido al chat.
  const paidByPhone = new Map<string, MoraOrder>();
  for (const order of paidOrders) {
    const phone = phoneKey(order.customer?.phone);
    if (phone && !paidByPhone.has(phone)) paidByPhone.set(phone, order);
  }

  const byAd: CrmByAd = new Map();
  const total: AdsOutcome = { ...EMPTY_OUTCOME };
  const salesByDay = new Map<string, number>();
  const counted = new Set<string>();
  for (const chat of chats) {
    const adId = chat.referral?.sourceId ?? "";
    const row = byAd.get(adId) ?? { ...EMPTY_OUTCOME };
    row.crmChats += 1;
    total.crmChats += 1;
    const byPhone = paidByPhone.get(phoneKey(chat.phone));
    const chatAt = chat.referral?.at ?? chat.lastInboundAt ?? chat.lastAt;
    const order =
      (chat.orderId ? orders.get(chat.orderId) : undefined) ??
      (byPhone && (byPhone.paidAt ?? 0) >= chatAt ? byPhone : undefined);
    if (isPaid(order) && !counted.has(order.id)) {
      counted.add(order.id);
      row.sales += 1;
      row.revenue += order.totals.total;
      total.sales += 1;
      total.revenue += order.totals.total;
      const day = bogotaDay(order.paidAt);
      salesByDay.set(day, (salesByDay.get(day) ?? 0) + 1);
    }
    if (adId) byAd.set(adId, row);
  }

  let webSales = 0;
  let webRevenue = 0;
  for (const order of paidOrders) {
    if (counted.has(order.id) || !fromMeta(order)) continue;
    webSales += 1;
    webRevenue += order.totals.total;
    const day = bogotaDay(order.paidAt);
    salesByDay.set(day, (salesByDay.get(day) ?? 0) + 1);
  }

  return { byAd, total, webSales, webRevenue, salesByDay };
}

function addOutcome(target: AdsOutcome, extra: AdsOutcome) {
  target.crmChats += extra.crmChats;
  target.sales += extra.sales;
  target.revenue += extra.revenue;
}

function mainResult(campaign: { objective: string } & AdsMetrics & AdsOutcome): CampaignRow["result"] {
  const spend = campaign.spend;
  const cost = (value: number, per: 1 | 1000 = 1) => (value > 0 ? (spend / value) * per : 0);
  const chats = campaign.crmChats || campaign.chats;
  const objective = campaign.objective;
  if (chats > 0 || objective === "MESSAGES") {
    return { label: "Chats", value: chats, cost: cost(chats), per: 1 };
  }
  if (objective === "OUTCOME_SALES" || objective === "CONVERSIONS") {
    const value = Math.max(campaign.pixelPurchases, campaign.sales);
    return { label: "Compras", value, cost: cost(value), per: 1 };
  }
  if (objective === "OUTCOME_LEADS" || objective === "LEAD_GENERATION") {
    return { label: "Clientes potenciales", value: campaign.leads, cost: cost(campaign.leads), per: 1 };
  }
  if (["OUTCOME_AWARENESS", "REACH", "BRAND_AWARENESS"].includes(objective)) {
    return { label: "Personas alcanzadas", value: campaign.reach, cost: cost(campaign.reach, 1000), per: 1000 };
  }
  return { label: "Clics al enlace", value: campaign.linkClicks, cost: cost(campaign.linkClicks), per: 1 };
}

function buildNotes(report: Omit<AdsReport, "notes" | "generatedAt">): AdsNote[] {
  const { totals, campaigns, currency, range } = report;
  const money = (value: number) => formatAdsMoney(value, currency);
  const notes: AdsNote[] = [];
  const sales = totals.sales + totals.webSales;
  const revenue = totals.revenue + totals.webRevenue;

  if (totals.spend === 0) {
    notes.push({ tone: "info", text: "En este periodo no hubo gasto en anuncios." });
    return notes;
  }

  if (sales > 0) {
    const back = revenue / totals.spend;
    notes.push({
      tone: back >= 1 ? "good" : "warn",
      text: `Cada venta te costó ${money(totals.spend / sales)} en anuncios. Por cada $1 que pusiste en Meta volvieron $${back.toLocaleString("es-CO", { maximumFractionDigits: 1 })} en ventas.`,
    });
  } else if (totals.crmChats > 0) {
    notes.push({
      tone: "warn",
      text: `Llegaron ${formatCount(totals.crmChats)} chats desde anuncios y ninguno ha comprado todavía. Revisa en el CRM cómo se están respondiendo.`,
    });
  }

  const ads = campaigns.flatMap((campaign) => campaign.ads);
  const campaignOf = new Map(campaigns.flatMap((campaign) => campaign.ads.map((ad) => [ad.id, campaign] as const)));
  /** «Nombre del anuncio», de la campaña «…» (en pausa): que no quede duda de cuál es. */
  const which = (ad: AdRow) => {
    const campaign = campaignOf.get(ad.id);
    const sameName = !campaign || campaign.name.trim() === ad.name.trim();
    const paused = ad.status && ad.status !== "ACTIVE" ? ` (${ad.statusLabel.toLowerCase()})` : "";
    return `«${ad.name}»${sameName ? "" : `, de la campaña «${campaign.name}»`}${paused}`;
  };
  const art = (ad: AdRow) => ({ thumbnail: ad.thumbnail || undefined, isVideo: ad.isVideo });

  const withChats = ads
    .map((ad) => ({ ad, chats: ad.crmChats || ad.chats }))
    .filter((row) => row.chats >= 2 && row.ad.spend > 0)
    .sort((a, b) => a.ad.spend / a.chats - b.ad.spend / b.chats);
  if (withChats.length >= 2) {
    const best = withChats[0];
    const paused = best.ad.status && best.ad.status !== "ACTIVE";
    notes.push({
      tone: "good",
      text: `El anuncio que trae chats más barato es ${which(best.ad)}: ${money(best.ad.spend / best.chats)} por chat${
        best.ad.crmChats ? `, ${formatCount(best.ad.crmChats)} chats en el CRM` : ""
      }. ${paused ? "Vale la pena prenderlo otra vez." : "Si vas a subir presupuesto, empieza por ese."}`,
      ...art(best.ad),
    });
  }

  const waste = ads
    .filter((ad) => ad.spend >= totals.spend * 0.2 && !ad.chats && !ad.crmChats && !ad.sales && !ad.pixelPurchases)
    .sort((a, b) => b.spend - a.spend)[0];
  if (waste) {
    // Un anuncio de tráfico no busca chats: si trae clics, lo que falla es la página, no el anuncio.
    notes.push({
      tone: "warn",
      text:
        waste.linkClicks > 0
          ? `${which(waste)} lleva ${money(waste.spend)} y llevó ${formatCount(waste.linkClicks)} clics a la web, pero ninguna venta todavía. Revisa a qué página llegan.`
          : `${which(waste)} lleva ${money(waste.spend)} gastados sin traer chats, clics ni ventas. Considera apagarlo o cambiarle la imagen.`,
      ...art(waste),
    });
  }

  for (const campaign of campaigns) {
    const frequency = campaign.reach > 0 ? campaign.impressions / campaign.reach : 0;
    if (campaign.active && range !== "today" && frequency >= 3.5) {
      notes.push({
        tone: "warn",
        text: `En «${campaign.name}» cada persona ya vio el anuncio ${frequency.toLocaleString("es-CO", { maximumFractionDigits: 1 })} veces en promedio. Se está cansando el público: cambia la imagen o amplía a quién le llega.`,
        thumbnail: campaign.thumbnail || undefined,
        isVideo: campaign.isVideo,
      });
      break;
    }
  }

  const idle = campaigns.find((campaign) => campaign.active && campaign.spend === 0);
  if (idle && range !== "today") {
    notes.push({
      tone: "info",
      text: `«${idle.name}» está activa pero no gastó nada en este periodo. Revisa en Meta si quedó en revisión o sin presupuesto.`,
      thumbnail: idle.thumbnail || undefined,
      isVideo: idle.isVideo,
    });
  }

  if (totals.chats >= 5 && totals.chats > totals.crmChats * 1.5) {
    notes.push({
      tone: "info",
      text: `Meta cuenta ${formatCount(totals.chats)} chats y al CRM llegaron ${formatCount(totals.crmChats)}. La diferencia suele ser gente que abrió WhatsApp y no alcanzó a escribir.`,
    });
  }

  return notes.slice(0, 5);
}

const cache = new Map<string, { at: number; report: AdsReport }>();
const CACHE_MS = 5 * 60_000;

export async function buildAdsReport(range: AdsRange, options: { fresh?: boolean } = {}): Promise<AdsReport> {
  const settings = await loadGrowthSettings();
  const token = settings.metaAdsToken;
  const accountId = settings.metaAdAccountId;
  if (!token || !accountId) {
    throw Object.assign(new Error("Conecta la cuenta publicitaria de Meta."), { status: 409 });
  }
  const currency = settings.metaAdsCurrency || "COP";
  const { since, until, startMs, endMs } = rangeDays(range);
  const key = `${accountId}:${range}:${since}:${until}`;
  const hit = cache.get(key);
  if (!options.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.report;

  const span = { since, until };
  const [campaigns, adSets, accountRows, campaignRows, adRows, dailyRows, crm] = await Promise.all([
    fetchCampaigns(accountId, token),
    fetchAdSets(accountId, token),
    fetchInsights(accountId, token, { level: "account", ...span }),
    fetchInsights(accountId, token, { level: "campaign", ...span }),
    fetchInsights(accountId, token, { level: "ad", ...span }),
    fetchInsights(accountId, token, { level: "account", ...span, daily: true }),
    loadCrm(startMs, endMs),
  ]);

  const adIds = new Set(adRows.map((row) => row.ad_id).filter((id): id is string => Boolean(id)));
  const crmOnly = [...crm.byAd.keys()].filter((id) => id && !adIds.has(id));
  const adDetails: MetaAd[] = await fetchAds(accountId, [...adIds, ...crmOnly], token).catch((error) => {
    console.error("[meta ads] detalle de anuncios", error);
    return [];
  });
  const adById = new Map(adDetails.map((ad) => [ad.id, ad]));
  const adMetrics = new Map(adRows.map((row) => [row.ad_id ?? "", metricsFromRow(row)]));

  const adsByCampaign = new Map<string, AdRow[]>();
  for (const id of new Set([...adIds, ...crmOnly])) {
    const detail = adById.get(id);
    const campaignId = detail?.campaign_id ?? adRows.find((row) => row.ad_id === id)?.campaign_id;
    if (!campaignId) continue;
    const creative = detail?.creative;
    const row: AdRow = {
      ...EMPTY_METRICS,
      ...adMetrics.get(id),
      ...EMPTY_OUTCOME,
      ...crm.byAd.get(id),
      id,
      name: detail?.name || "Anuncio",
      status: detail?.effective_status ?? "",
      statusLabel: statusLabel(detail?.effective_status),
      thumbnail: creative?.thumbnail_url || creative?.image_url || "",
      isVideo: creative?.object_type === "VIDEO",
      text: (creative?.body || creative?.title || "").slice(0, 160),
    };
    const list = adsByCampaign.get(campaignId) ?? [];
    list.push(row);
    adsByCampaign.set(campaignId, list);
  }

  const campaignMetrics = new Map(campaignRows.map((row) => [row.campaign_id ?? "", metricsFromRow(row)]));
  const budgets = new Map<string, { daily: number; lifetime: number }>();
  for (const set of adSets) {
    if (set.effective_status !== "ACTIVE") continue;
    const current = budgets.get(set.campaign_id) ?? { daily: 0, lifetime: 0 };
    current.daily += budgetToAmount(set.daily_budget, currency);
    current.lifetime += budgetToAmount(set.lifetime_budget, currency);
    budgets.set(set.campaign_id, current);
  }

  const rows: CampaignRow[] = campaigns
    .map((campaign) => {
      const metrics = { ...EMPTY_METRICS, ...campaignMetrics.get(campaign.id) };
      const ads = (adsByCampaign.get(campaign.id) ?? []).sort(
        (a, b) => b.spend - a.spend || b.crmChats - a.crmChats,
      );
      const outcome = { ...EMPTY_OUTCOME };
      for (const ad of ads) addOutcome(outcome, ad);
      const setBudget = budgets.get(campaign.id);
      const objective = campaign.objective ?? "";
      const base = { ...metrics, ...outcome, objective };
      const cover = ads.find((ad) => ad.thumbnail);
      return {
        ...base,
        id: campaign.id,
        name: campaign.name,
        objectiveLabel: OBJECTIVE_LABEL[objective] ?? "Campaña",
        status: campaign.effective_status ?? "",
        statusLabel: statusLabel(campaign.effective_status),
        active: campaign.effective_status === "ACTIVE",
        dailyBudget: budgetToAmount(campaign.daily_budget, currency) || setBudget?.daily || 0,
        lifetimeBudget: budgetToAmount(campaign.lifetime_budget, currency) || setBudget?.lifetime || 0,
        startTime: campaign.start_time ?? "",
        stopTime: campaign.stop_time ?? "",
        thumbnail: cover?.thumbnail ?? "",
        isVideo: cover?.isVideo ?? false,
        result: mainResult(base),
        ads,
      };
    })
    .filter((row) => row.spend > 0 || row.active || row.crmChats > 0)
    .sort((a, b) => Number(b.active) - Number(a.active) || b.spend - a.spend);

  const dailyBySpan = new Map(dailyRows.map((row) => [row.date_start ?? "", metricsFromRow(row)]));
  const days: AdsDay[] = eachDay(since, until).map((date) => {
    const metrics = dailyBySpan.get(date);
    return {
      date,
      spend: metrics?.spend ?? 0,
      chats: metrics?.chats ?? 0,
      linkClicks: metrics?.linkClicks ?? 0,
      sales: crm.salesByDay.get(date) ?? 0,
    };
  });

  const draft: Omit<AdsReport, "notes" | "generatedAt"> = {
    range,
    since,
    until,
    currency,
    accountName: settings.metaAdAccountName,
    totals: {
      ...EMPTY_METRICS,
      ...metricsFromRow(accountRows[0]),
      ...crm.total,
      webSales: crm.webSales,
      webRevenue: crm.webRevenue,
    },
    campaigns: rows,
    days,
  };
  const report: AdsReport = { ...draft, notes: buildNotes(draft), generatedAt: Date.now() };
  cache.set(key, { at: Date.now(), report });
  return report;
}
