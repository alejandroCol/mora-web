import type { AdAccountOption, AdsMetrics } from "@/ads/types";

/**
 * Marketing API de Meta, solo lectura (`ads_read`). Misma versión que WhatsApp
 * e Instagram. https://developers.facebook.com/docs/marketing-api/insights
 */
const GRAPH = "https://graph.facebook.com/v21.0";

export class MetaAdsError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

type GraphPage<T> = { data?: T[]; paging?: { next?: string }; error?: GraphErrorBody };
type GraphErrorBody = { message?: string; code?: number; error_user_msg?: string };

async function graphGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: GraphErrorBody };
  if (!res.ok || body.error) {
    const error = body.error ?? {};
    throw new MetaAdsError(error.error_user_msg || error.message || `Meta respondió ${res.status}.`, error.code ?? res.status);
  }
  return body;
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

/** Sigue `paging.next` hasta el final (con tope para no quedarse en un bucle). */
async function graphAll<T>(path: string, params: Record<string, string | number | undefined>, token: string) {
  const rows: T[] = [];
  let url: string | undefined = `${GRAPH}/${path}?${query({ ...params, access_token: token })}`;
  for (let page = 0; url && page < 20; page += 1) {
    const body: GraphPage<T> = await graphGet<GraphPage<T>>(url);
    rows.push(...(body.data ?? []));
    url = body.paging?.next;
  }
  return rows;
}

/** Monedas que Meta maneja sin centavos: ahí `daily_budget` ya viene en pesos. */
const OFFSET_ONE = new Set(["CLP", "COP", "CRC", "HUF", "ISK", "IDR", "JPY", "KRW", "PYG", "TWD", "VND"]);

export function budgetToAmount(raw: string | undefined, currency: string) {
  const value = Number(raw ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return OFFSET_ONE.has(currency.toUpperCase()) ? value : value / 100;
}

export async function listAdAccounts(token: string): Promise<AdAccountOption[]> {
  const rows = await graphAll<{ id: string; name?: string; currency?: string; account_status?: number }>(
    "me/adaccounts",
    { fields: "id,name,currency,account_status", limit: 100 },
    token,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name || row.id,
    currency: row.currency || "COP",
    // 1 = activa. 2 deshabilitada, 3 sin pagar, 101 cerrada…
    active: row.account_status === 1,
  }));
}

export type MetaCampaign = {
  id: string;
  name: string;
  objective?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
};

export type MetaAdSet = {
  id: string;
  campaign_id: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export type MetaAd = {
  id: string;
  name?: string;
  campaign_id?: string;
  effective_status?: string;
  creative?: { thumbnail_url?: string; image_url?: string; body?: string; title?: string };
};

type MetaAction = { action_type: string; value: string };

export type MetaInsightRow = {
  campaign_id?: string;
  ad_id?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  inline_link_clicks?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
};

export function fetchCampaigns(accountId: string, token: string) {
  return graphAll<MetaCampaign>(
    `${accountId}/campaigns`,
    {
      fields: "id,name,objective,effective_status,daily_budget,lifetime_budget,start_time,stop_time",
      limit: 200,
    },
    token,
  );
}

export function fetchAdSets(accountId: string, token: string) {
  return graphAll<MetaAdSet>(
    `${accountId}/adsets`,
    { fields: "id,campaign_id,effective_status,daily_budget,lifetime_budget", limit: 300 },
    token,
  );
}

/** Detalle (nombre, estado, creativo) de los anuncios que gastaron en el periodo. */
export async function fetchAds(ids: string[], token: string) {
  const out: MetaAd[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const body = await graphGet<Record<string, MetaAd>>(
      `${GRAPH}/?${query({
        ids: chunk.join(","),
        fields: "id,name,campaign_id,effective_status,creative{thumbnail_url,image_url,body,title}",
        access_token: token,
      })}`,
    );
    out.push(...Object.values(body));
  }
  return out;
}

const INSIGHT_FIELDS = "spend,impressions,reach,inline_link_clicks,actions,action_values";

export function fetchInsights(
  accountId: string,
  token: string,
  options: { level: "account" | "campaign" | "ad"; since: string; until: string; daily?: boolean },
) {
  const idField = options.level === "campaign" ? "campaign_id," : options.level === "ad" ? "ad_id,campaign_id," : "";
  return graphAll<MetaInsightRow>(
    `${accountId}/insights`,
    {
      level: options.level,
      fields: `${idField}${INSIGHT_FIELDS}`,
      time_range: JSON.stringify({ since: options.since, until: options.until }),
      time_increment: options.daily ? 1 : undefined,
      limit: 500,
    },
    token,
  );
}

const CHAT_ACTIONS = ["onsite_conversion.messaging_conversation_started_7d"];
/** Meta repite la misma compra con varios nombres: se toma el mayor, no la suma. */
const PURCHASE_ACTIONS = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];
const LEAD_ACTIONS = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];

function pick(list: MetaAction[] | undefined, types: string[]) {
  if (!list) return 0;
  let best = 0;
  for (const type of types) {
    const row = list.find((item) => item.action_type === type);
    if (row) best = Math.max(best, Number(row.value) || 0);
  }
  return best;
}

export function metricsFromRow(row: MetaInsightRow | undefined): AdsMetrics {
  return {
    spend: Number(row?.spend ?? 0) || 0,
    impressions: Number(row?.impressions ?? 0) || 0,
    reach: Number(row?.reach ?? 0) || 0,
    linkClicks: Number(row?.inline_link_clicks ?? 0) || 0,
    chats: pick(row?.actions, CHAT_ACTIONS),
    pixelPurchases: pick(row?.actions, PURCHASE_ACTIONS),
    pixelRevenue: pick(row?.action_values, PURCHASE_ACTIONS),
    leads: pick(row?.actions, LEAD_ACTIONS),
  };
}
