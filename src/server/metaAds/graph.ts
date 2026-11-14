import type { AdAccountOption, AdsMetrics } from "@/ads/types";

/**
 * Marketing API de Meta. Leer pide `ads_read`; crear y cambiar, `ads_management`.
 * La versión va explícita: Meta sube sola las versiones vencidas (v21 ya
 * respondía como v26) y al escribir conviene saber contra cuál se habla.
 * https://developers.facebook.com/docs/marketing-api
 */
export const GRAPH = "https://graph.facebook.com/v26.0";

export class MetaAdsError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

type GraphPage<T> = { data?: T[]; paging?: { next?: string }; error?: GraphErrorBody };
type GraphErrorBody = { message?: string; code?: number; error_user_msg?: string; error_user_title?: string };

async function graphGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: GraphErrorBody };
  if (!res.ok || body.error) {
    const error = body.error ?? {};
    throw new MetaAdsError(error.error_user_msg || error.message || `Meta respondió ${res.status}.`, error.code ?? res.status);
  }
  return body;
}

/** Un objeto o una respuesta sin paginar. */
export function graphOne<T>(path: string, params: Record<string, string | number | undefined>, token: string) {
  return graphGet<T>(`${GRAPH}/${path}?${query({ ...params, access_token: token })}`);
}

/** Escritura. El token va en la cabecera, nunca en la URL ni en el cuerpo. */
export async function graphWrite<T>(
  method: "POST" | "DELETE",
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: GraphErrorBody };
  if (!res.ok || data.error) {
    const error = data.error ?? {};
    // `error_user_msg` es el que explica qué campo falló; `message` suele ser «Invalid parameter».
    const text = [error.error_user_title, error.error_user_msg].filter(Boolean).join(": ");
    throw new MetaAdsError(text || error.message || `Meta respondió ${res.status}.`, error.code ?? res.status);
  }
  return data;
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

/** Lo contrario de `budgetToAmount`: lo que Meta espera recibir. */
export function amountToBudget(amount: number, currency: string) {
  return OFFSET_ONE.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
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
  name?: string;
  campaign_id: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  /** Qué busca Meta: CONVERSATIONS, OFFSITE_CONVERSIONS, VISIT_INSTAGRAM_PROFILE… */
  optimization_goal?: string;
  destination_type?: string;
  end_time?: string;
};

export type MetaAd = {
  id: string;
  name?: string;
  campaign_id?: string;
  adset_id?: string;
  effective_status?: string;
  issues_info?: { error_summary?: string; error_message?: string }[];
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    body?: string;
    title?: string;
    object_type?: string;
    source_instagram_media_id?: string;
  };
};

type MetaAction = { action_type: string; value: string };

export type MetaInsightRow = {
  campaign_id?: string;
  adset_id?: string;
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
    {
      fields:
        "id,name,campaign_id,effective_status,daily_budget,lifetime_budget,optimization_goal,destination_type,end_time",
      limit: 300,
    },
    token,
  );
}

/** Por defecto Meta esconde los anuncios archivados; un chat viejo puede venir de uno. */
const AD_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "CAMPAIGN_PAUSED",
  "ADSET_PAUSED",
  "ARCHIVED",
  "IN_PROCESS",
  "WITH_ISSUES",
  "PENDING_REVIEW",
  "DISAPPROVED",
  "PREAPPROVED",
  "PENDING_BILLING_INFO",
];

/**
 * Detalle (nombre, estado, creativo) de los anuncios que gastaron o trajeron chats.
 * Se filtra la cuenta por id: `?ids=` ya no lo acepta Meta, y un id ajeno
 * aquí solo no aparece en vez de tumbar la consulta.
 */
export async function fetchAds(accountId: string, ids: string[], token: string) {
  const out: MetaAd[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    out.push(
      ...(await graphAll<MetaAd>(
        `${accountId}/ads`,
        {
          filtering: JSON.stringify([{ field: "id", operator: "IN", value: chunk }]),
          effective_status: JSON.stringify(AD_STATUSES),
          // Sin tamaño, Meta da la miniatura a 64 px y se ve borrosa.
          fields:
            "id,name,campaign_id,adset_id,effective_status,issues_info,creative.thumbnail_width(480).thumbnail_height(480){thumbnail_url,image_url,body,title,object_type,source_instagram_media_id}",
          limit: 50,
        },
        token,
      )),
    );
  }
  return out;
}

const INSIGHT_FIELDS = "spend,impressions,reach,inline_link_clicks,actions,action_values";

export function fetchInsights(
  accountId: string,
  token: string,
  options: { level: "account" | "campaign" | "ad"; since: string; until: string; daily?: boolean },
) {
  const idField =
    options.level === "campaign" ? "campaign_id," : options.level === "ad" ? "ad_id,adset_id,campaign_id," : "";
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
const LANDING_ACTIONS = ["omni_landing_page_view", "landing_page_view"];
const CONTENT_ACTIONS = ["omni_view_content", "view_content", "offsite_conversion.fb_pixel_view_content"];
const CART_ACTIONS = ["omni_add_to_cart", "add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"];
const CHECKOUT_ACTIONS = [
  "omni_initiated_checkout",
  "initiate_checkout",
  "offsite_conversion.fb_pixel_initiate_checkout",
];

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
    landingViews: pick(row?.actions, LANDING_ACTIONS),
    contentViews: pick(row?.actions, CONTENT_ACTIONS),
    addToCart: pick(row?.actions, CART_ACTIONS),
    checkouts: pick(row?.actions, CHECKOUT_ACTIONS),
  };
}
