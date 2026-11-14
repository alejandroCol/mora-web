import { formatAdsMoney } from "@/ads/format";
import { MAX_ADS_PER_CAMPAIGN, recipeOf } from "@/ads/recipes";
import { describeSegment, sanitizeSegment } from "@/ads/segment";
import type { AdsChange, AdsCreateOptions, AdsCreated, AdsMedia, AdsWebEvent } from "@/ads/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadGrowthSettings } from "../growthSettings";
import { loadAdsAccess, requireAdsManage } from "./access";
import { loadAudiencesState } from "./audiences";
import { MetaAdsError, amountToBudget, graphOne, graphWrite } from "./graph";
import { loadAdsPilotSettings } from "./pilotSettings";
import { buildAdsReport, clearAdsReportCache } from "./report";
import { toTargetingSpec } from "./targeting";

const LOG = "adsChangeLog";
const SITE_HOSTS = ["moraring.com", "www.moraring.com"];
const DEFAULT_LINK = "https://moraring.com/";
const WEB_EVENTS: AdsWebEvent[] = ["PURCHASE", "INITIATED_CHECKOUT", "ADD_TO_CART"];

function bad(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

type IgMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  boost_eligibility_info?: { eligible_to_boost?: boolean };
};

/** Las últimas publicaciones de Instagram: de ahí salen los anuncios, con sus likes y comentarios. */
async function loadInstagramMedia(instagramId: string, token: string): Promise<AdsMedia[]> {
  const body = await graphOne<{ data?: IgMedia[] }>(
    `${instagramId}/media`,
    {
      fields:
        "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,boost_eligibility_info",
      limit: 40,
    },
    token,
  );
  return (body.data ?? []).map((item) => ({
    id: item.id,
    caption: (item.caption ?? "").slice(0, 220),
    thumbnail: item.thumbnail_url || item.media_url || "",
    isVideo: item.media_type === "VIDEO",
    permalink: item.permalink ?? "",
    at: item.timestamp ? Date.parse(item.timestamp) : 0,
    likes: item.like_count ?? 0,
    comments: item.comments_count ?? 0,
    eligible: item.boost_eligibility_info?.eligible_to_boost !== false,
  }));
}

/** Todo lo que el formulario necesita para armar una campaña sin adivinar. */
export async function loadCreateOptions(): Promise<AdsCreateOptions> {
  const settings = await loadGrowthSettings();
  if (!settings.metaAdsToken || !settings.metaAdAccountId) {
    throw bad("Conecta la cuenta publicitaria de Meta.", 409);
  }
  const blockers: string[] = [];
  if (!settings.instagramPageId) blockers.push("Falta la página de Facebook: conéctala en Automatizaciones.");
  if (!settings.instagramAccountId) blockers.push("Falta la cuenta de Instagram: conéctala en Automatizaciones.");
  if (!settings.whatsappDisplayNumber) blockers.push("Falta el número de WhatsApp en Crecimiento.");
  if (!settings.metaPixelId) blockers.push("Falta el Pixel en Crecimiento: sin él no hay campañas de web.");

  const [access, pilot, media, audiences, report] = await Promise.all([
    loadAdsAccess(),
    loadAdsPilotSettings(),
    settings.instagramAccountId
      ? loadInstagramMedia(settings.instagramAccountId, settings.metaAdsToken).catch(() => [] as AdsMedia[])
      : Promise.resolve([] as AdsMedia[]),
    loadAudiencesState().catch(() => ({ audiences: [], others: [], syncedAt: 0 })),
    buildAdsReport("30d").catch(() => null),
  ]);

  // Lo que ya rindió cada publicación cuando salió como anuncio.
  const used = new Map<string, NonNullable<AdsMedia["used"]>>();
  for (const campaign of report?.campaigns ?? []) {
    for (const ad of campaign.ads) {
      if (!ad.mediaId) continue;
      const row = used.get(ad.mediaId) ?? { spend: 0, chats: 0, sales: 0, ads: 0 };
      row.spend += ad.spend;
      row.chats += ad.crmChats || ad.chats;
      row.sales += ad.sales;
      row.ads += 1;
      used.set(ad.mediaId, row);
    }
  }

  const floor = Math.max(access.minDailyBudget, 5_000);
  return {
    access,
    currency: settings.metaAdsCurrency || "COP",
    media: media.map((item) => ({ ...item, used: used.get(item.id) })),
    audiences: audiences.audiences,
    others: audiences.others,
    defaults: { link: DEFAULT_LINK, dailyBudget: Math.max(floor, 20_000) },
    limits: { minDailyBudget: floor, maxDailyPerCampaign: pilot.maxDailyPerCampaign },
    blockers,
  };
}

function cleanLink(raw: unknown) {
  const text = typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_LINK;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw bad("El enlace no es válido.");
  }
  if (url.protocol !== "https:" || !SITE_HOSTS.includes(url.hostname)) {
    throw bad("El anuncio solo puede llevar a moraring.com.");
  }
  return url.toString();
}

function adName(media: AdsMedia | undefined, index: number) {
  const caption = (media?.caption ?? "").replace(/\s+/g, " ").trim();
  const label = caption ? caption.slice(0, 42) : `Publicación ${index + 1}`;
  return `${media?.isVideo ? "Video" : "Foto"} · ${label}`;
}

function step(label: string, error: unknown): never {
  const detail = error instanceof MetaAdsError ? error.message : error instanceof Error ? error.message : "sin respuesta";
  throw bad(`Meta no aceptó ${label}: ${detail}`, 502);
}

/**
 * Crea campaña, conjunto y anuncios a partir de publicaciones de Instagram.
 * La campaña nace EN PAUSA: nada gasta hasta que alguien la prenda desde el panel
 * (y ahí se revisa el tope diario). Si un paso falla, se borra lo que alcanzó a crearse.
 */
export async function createAdsCampaign(raw: unknown, by: { uid: string; name: string }): Promise<AdsCreated> {
  const access = await requireAdsManage();
  const settings = await loadGrowthSettings();
  const token = settings.metaAdsToken;
  const accountId = settings.metaAdAccountId;
  const currency = settings.metaAdsCurrency || "COP";
  const money = (value: number) => formatAdsMoney(value, currency);
  const input = (raw ?? {}) as Record<string, unknown>;

  const recipe = recipeOf(typeof input.recipe === "string" ? input.recipe : undefined);
  if (!recipe) throw bad("Elige qué tipo de campaña quieres.");

  const name = (typeof input.name === "string" ? input.name : "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (name.length < 3) throw bad("Ponle un nombre a la campaña.");

  const pilot = await loadAdsPilotSettings();
  const budget = Math.round(Number(input.dailyBudget));
  const floor = Math.max(access.minDailyBudget, 5_000);
  if (!Number.isFinite(budget) || budget < floor) throw bad(`El mínimo diario es ${money(floor)}.`);
  if (pilot.maxDailyPerCampaign > 0 && budget > pilot.maxDailyPerCampaign) {
    throw bad(`Tu tope por campaña es ${money(pilot.maxDailyPerCampaign)} al día. Súbelo en Piloto si quieres más.`, 409);
  }

  const segment = sanitizeSegment(input.segment);
  if (segment.scope === "places" && segment.places.length === 0) {
    throw bad("Elegiste «solo algunos lugares» pero no hay ninguno.");
  }
  if (recipe.remarketing) {
    if (segment.include.length === 0) throw bad("El remarketing necesita al menos una audiencia a la que mostrarle.");
    // En abierta Meta se sale de las audiencias y deja de ser remarketing.
    segment.strict = true;
  }

  const pageId = settings.instagramPageId;
  const instagramId = settings.instagramAccountId;
  if (!pageId || !instagramId) throw bad("Conecta la página y la cuenta de Instagram en Automatizaciones.", 409);
  if (recipe.destination === "whatsapp" && !settings.whatsappDisplayNumber) {
    throw bad("Falta el número de WhatsApp en Crecimiento.", 409);
  }
  if (recipe.destination === "web" && !settings.metaPixelId) throw bad("Falta el Pixel en Crecimiento.", 409);

  const mediaIds = Array.isArray(input.mediaIds)
    ? [...new Set(input.mediaIds.filter((id): id is string => typeof id === "string" && /^\d{8,30}$/.test(id)))]
    : [];
  if (mediaIds.length === 0) throw bad("Elige al menos una publicación para el anuncio.");
  if (mediaIds.length > MAX_ADS_PER_CAMPAIGN) {
    throw bad(`Máximo ${MAX_ADS_PER_CAMPAIGN} anuncios por campaña: con más, el presupuesto no alcanza para probarlos.`);
  }
  const library = await loadInstagramMedia(instagramId, token);
  const chosen = mediaIds.map((id) => library.find((item) => item.id === id));
  if (chosen.some((item) => !item)) throw bad("Una de las publicaciones ya no está en el Instagram de Mora.");
  if (chosen.some((item) => item && !item.eligible)) {
    throw bad("Instagram no deja promocionar una de esas publicaciones (música con derechos o formato). Elige otra.");
  }

  const link = recipe.destination === "web" ? cleanLink(input.link) : "";
  const webEvent: AdsWebEvent = WEB_EVENTS.includes(input.webEvent as AdsWebEvent)
    ? (input.webEvent as AdsWebEvent)
    : "PURCHASE";

  let campaignId = "";
  try {
    const campaign = await graphWrite<{ id: string }>(
      "POST",
      `${accountId}/campaigns`,
      {
        name,
        objective: recipe.destination === "whatsapp" ? "OUTCOME_ENGAGEMENT" : "OUTCOME_SALES",
        status: "PAUSED",
        buying_type: "AUCTION",
        special_ad_categories: [],
        daily_budget: amountToBudget(budget, currency),
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      },
      token,
    ).catch((error) => step("la campaña", error));
    campaignId = campaign.id;

    // Conjunto y anuncios quedan activos por dentro: el interruptor es la campaña.
    const adSet = await graphWrite<{ id: string }>(
      "POST",
      `${accountId}/adsets`,
      {
        name: `${name} · ${segment.strict ? "exacta" : "abierta"}`,
        campaign_id: campaignId,
        status: "ACTIVE",
        billing_event: "IMPRESSIONS",
        targeting: toTargetingSpec(segment),
        ...(recipe.destination === "whatsapp"
          ? {
              optimization_goal: "CONVERSATIONS",
              destination_type: "WHATSAPP",
              promoted_object: { page_id: pageId, whatsapp_phone_number: settings.whatsappDisplayNumber },
            }
          : {
              optimization_goal: "OFFSITE_CONVERSIONS",
              destination_type: "WEBSITE",
              promoted_object: { pixel_id: settings.metaPixelId, custom_event_type: webEvent },
            }),
      },
      token,
    ).catch((error) => step("la segmentación", error));

    const adIds: string[] = [];
    for (const [index, media] of chosen.entries()) {
      const label = adName(media, index);
      const creative = await graphWrite<{ id: string }>(
        "POST",
        `${accountId}/adcreatives`,
        {
          name: label,
          object_id: pageId,
          instagram_user_id: instagramId,
          source_instagram_media_id: media!.id,
          call_to_action:
            recipe.destination === "whatsapp"
              ? {
                  type: "WHATSAPP_MESSAGE",
                  value: { link: "https://api.whatsapp.com/send", app_destination: "WHATSAPP" },
                }
              : { type: "SHOP_NOW", value: { link } },
          // La web reconoce de qué anuncio vino la compra.
          ...(recipe.destination === "web"
            ? { url_tags: "utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}" }
            : {}),
        },
        token,
      ).catch((error) => step(`el anuncio ${index + 1}`, error));
      const ad = await graphWrite<{ id: string }>(
        "POST",
        `${accountId}/ads`,
        { name: label, adset_id: adSet.id, creative: { creative_id: creative.id }, status: "ACTIVE" },
        token,
      ).catch((error) => step(`el anuncio ${index + 1}`, error));
      adIds.push(ad.id);
    }

    const entry: Omit<AdsChange, "id"> = {
      at: Date.now(),
      by: by.uid,
      byName: by.name,
      source: "panel",
      action: { kind: "create", level: "campaign", id: campaignId, value: recipe.id },
      targetName: name,
      before: "",
      after: `Creada en pausa · ${money(budget)} al día · ${adIds.length} ${adIds.length === 1 ? "anuncio" : "anuncios"}`,
      reason: describeSegment(segment).slice(0, 400),
      ok: true,
    };
    await adminDb().collection(LOG).add(entry);
    clearAdsReportCache();
    return { campaignId, adSetId: adSet.id, adIds, name };
  } catch (error) {
    // Nada a medias en la cuenta: borrar la campaña se lleva el conjunto y los anuncios.
    if (campaignId) await graphWrite("DELETE", campaignId, {}, token).catch(() => undefined);
    throw error;
  }
}
