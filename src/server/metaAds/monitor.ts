import { formatAdsMoney, formatCount } from "@/ads/format";
import type {
  AdRow,
  AdsAccess,
  AdsDecision,
  AdsHealthCheck,
  AdsMonitor,
  AdsPilotSettings,
  AdsReport,
  CampaignRow,
} from "@/ads/types";
import { COLLECTIONS } from "@/commerce/paths";
import type { WhatsAppConversation } from "@/growth/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadGrowthSettings } from "../growthSettings";
import { loadMetaHealth, type MetaHealth } from "../metaHealth";
import { loadAdsAccess } from "./access";
import { loadAdsPilotSettings } from "./pilotSettings";
import { buildAdsReport } from "./report";

const MINUTE = 60_000;
const DAY = 86_400_000;
/** Un chat lleva «esperando» cuando el último mensaje es del cliente y pasó este tiempo. */
const WAIT_MS = 20 * MINUTE;
/** A partir de aquí la gente ya vio el anuncio demasiadas veces. */
const TIRED_FREQUENCY = 3.5;

/** Qué busca Meta con la campaña. De esto depende cómo se juzga. */
type Kind = "profile" | "chat" | "web" | "traffic" | "leads" | "other";

const CHAT_DESTINATIONS = ["WHATSAPP", "MESSENGER", "INSTAGRAM_DIRECT"];
const TRAFFIC_GOALS = ["LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH", "IMPRESSIONS", "POST_ENGAGEMENT", "THRUPLAY"];

export function campaignKind(campaign: CampaignRow): Kind {
  const { goals, destinations, objective } = campaign;
  if (goals.includes("VISIT_INSTAGRAM_PROFILE") || destinations.includes("INSTAGRAM_PROFILE")) return "profile";
  if (
    goals.includes("CONVERSATIONS") ||
    destinations.some((item) => CHAT_DESTINATIONS.some((chat) => item.includes(chat)))
  ) {
    return "chat";
  }
  if (goals.includes("OFFSITE_CONVERSIONS") || goals.includes("VALUE")) return "web";
  if (goals.includes("LEAD_GENERATION") || goals.includes("QUALITY_LEAD") || objective === "OUTCOME_LEADS") return "leads";
  if (
    goals.some((goal) => TRAFFIC_GOALS.includes(goal)) ||
    ["LINK_CLICKS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"].includes(objective)
  ) {
    return "traffic";
  }
  if (objective === "OUTCOME_SALES") return "web";
  return campaign.crmChats || campaign.chats ? "chat" : "other";
}

function ago(ms: number, now = Date.now()) {
  const minutes = Math.max(1, Math.round((now - ms) / MINUTE));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

function plural(count: number, one: string, many: string) {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

type CrmPulse = {
  /** Chats de venta con el último mensaje del cliente sin responder. */
  waiting: number;
  waitingFromAds: number;
  oldestAt: number;
  /** Chats de anuncio de los últimos 7 días que nadie movió de «Nuevo». */
  untouched: number;
};

async function loadCrmPulse(now: number): Promise<CrmPulse> {
  const snap = await adminDb()
    .collection(COLLECTIONS.whatsappConversations)
    .where("lastAt", ">=", now - 14 * DAY)
    .get();
  const pulse: CrmPulse = { waiting: 0, waitingFromAds: 0, oldestAt: 0, untouched: 0 };
  for (const doc of snap.docs) {
    const chat = doc.data() as WhatsAppConversation;
    if (chat.desk === "creators" || chat.desk === "support") continue;
    if (chat.status === "sold" || chat.status === "closed") continue;
    const fromAd = chat.source === "ad";
    const snoozed = (chat.snoozedUntil ?? 0) > now;
    if (chat.lastDirection === "in" && now - chat.lastAt > WAIT_MS && !snoozed) {
      pulse.waiting += 1;
      if (fromAd) pulse.waitingFromAds += 1;
      pulse.oldestAt = pulse.oldestAt ? Math.min(pulse.oldestAt, chat.lastAt) : chat.lastAt;
    }
    if (fromAd && chat.status === "new" && (chat.referral?.at ?? chat.lastAt) >= now - 7 * DAY) pulse.untouched += 1;
  }
  return pulse;
}

type Context = {
  money: (value: number) => string;
  pilot: AdsPilotSettings;
  access: AdsAccess;
};

function chatsOf(row: { crmChats: number; chats: number }) {
  return row.crmChats || row.chats;
}

function salesOf(row: { sales: number; pixelPurchases: number }) {
  return Math.max(row.sales, row.pixelPurchases);
}

function base(campaign: CampaignRow) {
  return {
    level: "campaign" as const,
    targetId: campaign.id,
    targetName: campaign.name,
    campaignName: campaign.name,
    thumbnail: campaign.thumbnail,
    isVideo: campaign.isVideo,
    dailyBudget: campaign.dailyBudget,
  };
}

function evidence(campaign: CampaignRow, context: Context) {
  const chats = chatsOf(campaign);
  const rows = [
    { label: "Gastado en 7 días", value: context.money(campaign.spend) },
    { label: "Chats", value: formatCount(chats) },
    { label: "Ventas", value: formatCount(salesOf(campaign)) },
  ];
  if (campaign.dailyBudget > 0) rows.push({ label: "Presupuesto", value: `${context.money(campaign.dailyBudget)} al día` });
  return rows;
}

function pauseAction(campaign: CampaignRow) {
  return {
    action: { kind: "status" as const, level: "campaign" as const, id: campaign.id, value: "PAUSED" as const },
    actionLabel: "Pausar campaña",
  };
}

/** Siguiente presupuesto al subir: redondeado a mil y sin pasar el tope. 0 si no hay a dónde subir. */
export function nextBudget(current: number, pilot: AdsPilotSettings) {
  if (current <= 0) return 0;
  const raised = Math.round((current * (1 + pilot.scaleStepPct / 100)) / 1000) * 1000;
  const capped = pilot.maxDailyPerCampaign > 0 ? Math.min(raised, pilot.maxDailyPerCampaign) : raised;
  return capped > current ? capped : 0;
}

function judgeCampaign(campaign: CampaignRow, context: Context): AdsDecision[] {
  const { money, pilot } = context;
  const out: AdsDecision[] = [];
  const kind = campaignKind(campaign);
  const chats = chatsOf(campaign);
  const sales = salesOf(campaign);
  const spend = campaign.spend;
  const free = campaign.dailyBudget > 0 ? `Liberas ${money(campaign.dailyBudget)} al día.` : "";
  const common = { ...base(campaign), evidence: evidence(campaign, context) };
  const frequency = campaign.reach > 0 ? campaign.impressions / campaign.reach : 0;

  if (kind === "profile" || kind === "traffic") {
    const seeks = kind === "profile" ? "visitas al perfil de Instagram" : "clics";
    if (sales > 0) {
      out.push({
        ...common,
        id: `keep:${campaign.id}`,
        verdict: "watch",
        priority: 30,
        title: "Déjala, pero cámbiale el objetivo cuando puedas",
        why: `Busca ${seeks}, y aun así dejó ${plural(sales, "venta", "ventas")} con ${money(spend)}. La misma publicación en una campaña de ventas o de WhatsApp debería rendir más.`,
        impact: "",
      });
    } else if (spend > 0) {
      out.push({
        ...common,
        id: `pause:${campaign.id}`,
        verdict: "pause",
        priority: 80 + Math.min(15, campaign.dailyBudget / 2000),
        title: `Apágala: busca ${seeks}, no ventas`,
        why: `Meta la optimiza para conseguir ${seeks}. Lleva ${money(spend)} en 7 días y dejó ${plural(chats, "chat", "chats")} y ninguna venta.`,
        impact: free,
        ...pauseAction(campaign),
      });
    } else {
      out.push({
        ...common,
        id: `watch:${campaign.id}`,
        verdict: "watch",
        priority: 20,
        title: "Recién arrancó y no busca ventas",
        why: `Está hecha para conseguir ${seeks}. Si lo que quieres es vender, esa plata rinde más en una campaña de WhatsApp.`,
        impact: free,
        ...pauseAction(campaign),
      });
    }
  }

  if (kind === "chat") {
    const costPerChat = chats > 0 ? spend / chats : 0;
    const enough = spend >= Math.max(pilot.minSpendToJudge, pilot.targetCostPerChat * 3);
    if (chats === 0 && enough) {
      out.push({
        ...common,
        id: `pause:${campaign.id}`,
        verdict: "pause",
        priority: 85,
        title: "Apágala: gasta y no trae chats",
        why: `Lleva ${money(spend)} en 7 días sin un solo chat. Tu meta es pagar hasta ${money(pilot.targetCostPerChat)} por chat.`,
        impact: free,
        ...pauseAction(campaign),
      });
    } else if (chats >= 3 && costPerChat > pilot.targetCostPerChat * 2) {
      out.push({
        ...common,
        id: `pause:${campaign.id}`,
        verdict: "pause",
        priority: 75,
        title: "Apágala o cámbiale el video: el chat sale muy caro",
        why: `Cada chat cuesta ${money(costPerChat)}, más del doble de tu meta de ${money(pilot.targetCostPerChat)}.`,
        impact: free,
        ...pauseAction(campaign),
      });
    } else if (chats > 0 && costPerChat <= pilot.targetCostPerChat) {
      const costPerSale = campaign.sales > 0 ? spend / campaign.sales : 0;
      const raise = campaign.budgetAtCampaign ? nextBudget(campaign.dailyBudget, pilot) : 0;
      if (campaign.sales > 0 && costPerSale <= pilot.targetCostPerSale) {
        out.push({
          ...common,
          id: `scale:${campaign.id}`,
          verdict: "scale",
          priority: 70,
          title: raise ? `Súbele a ${money(raise)} al día` : "Es la que vende: súbele presupuesto",
          why: `Dejó ${plural(campaign.sales, "venta", "ventas")} a ${money(costPerSale)} cada una, dentro de tu meta de ${money(pilot.targetCostPerSale)}. Los chats salen a ${money(costPerChat)}.`,
          impact: raise
            ? `Sube ${pilot.scaleStepPct} % y no más: un salto grande reinicia el aprendizaje de Meta.`
            : campaign.budgetAtCampaign
              ? "Ya está en tu tope por campaña. Súbelo en Piloto si quieres darle más."
              : "El presupuesto está en los conjuntos: súbelo en Meta.",
          ...(raise
            ? {
                action: { kind: "budget" as const, level: "campaign" as const, id: campaign.id, value: raise },
                actionLabel: `Subir a ${money(raise)}`,
              }
            : {}),
        });
      } else if (chats >= 20 && campaign.sales === 0) {
        out.push({
          ...common,
          id: `fix:${campaign.id}`,
          verdict: "fix",
          priority: 60,
          title: "Trae chats baratos, pero ninguno compra",
          why: `Van ${formatCount(chats)} chats a ${money(costPerChat)} cada uno y ninguna venta. El anuncio cumple; lo que falla es la conversación o la oferta. No le subas hasta que cierre.`,
          impact: "Revisa en el CRM qué preguntan y dónde se enfrían.",
        });
      } else {
        out.push({
          ...common,
          id: `keep:${campaign.id}`,
          verdict: "keep",
          priority: 15,
          title: "Déjala como está",
          why: `Trae chats a ${money(costPerChat)}, por debajo de tu meta de ${money(pilot.targetCostPerChat)}. ${
            campaign.sales > 0
              ? `Lleva ${plural(campaign.sales, "venta", "ventas")}, a ${money(costPerSale)} cada una.`
              : "Todavía es pronto para saber si esos chats compran."
          }`,
          impact: "",
        });
      }
    } else if (!enough) {
      out.push({
        ...common,
        id: `watch:${campaign.id}`,
        verdict: "watch",
        priority: 10,
        title: "Todavía no hay datos para decidir",
        why: `Lleva ${money(spend)} y ${plural(chats, "chat", "chats")}. Se puede juzgar cuando pase de ${money(Math.max(pilot.minSpendToJudge, pilot.targetCostPerChat * 3))}.`,
        impact: "",
      });
    } else {
      // Entre la meta y el doble: ni tan mala para apagarla ni tan buena para subirle.
      out.push({
        ...common,
        id: `watch:${campaign.id}`,
        verdict: "watch",
        priority: 35,
        title: "Está cara, pero no para apagarla todavía",
        why: `Cada chat sale a ${money(costPerChat)} y tu meta es ${money(pilot.targetCostPerChat)}. ${
          campaign.sales > 0 ? `Lleva ${plural(campaign.sales, "venta", "ventas")}.` : "Aún no deja ventas."
        }`,
        impact: "Pruébale otro video antes de tocar el presupuesto.",
      });
    }
  }

  if (kind === "web") {
    if (sales > 0) {
      const costPerSale = spend / sales;
      const raise = campaign.budgetAtCampaign ? nextBudget(campaign.dailyBudget, pilot) : 0;
      if (costPerSale <= pilot.targetCostPerSale) {
        out.push({
          ...common,
          id: `scale:${campaign.id}`,
          verdict: "scale",
          priority: 72,
          title: raise ? `Súbele a ${money(raise)} al día` : "Está vendiendo dentro de la meta",
          why: `Dejó ${plural(sales, "venta", "ventas")} a ${money(costPerSale)} cada una; tu meta es ${money(pilot.targetCostPerSale)}.`,
          impact: raise ? `Sube ${pilot.scaleStepPct} % y vuelve a mirar en tres días.` : "",
          ...(raise
            ? {
                action: { kind: "budget" as const, level: "campaign" as const, id: campaign.id, value: raise },
                actionLabel: `Subir a ${money(raise)}`,
              }
            : {}),
        });
      } else if (costPerSale > pilot.targetCostPerSale * 2) {
        out.push({
          ...common,
          id: `pause:${campaign.id}`,
          verdict: "pause",
          priority: 78,
          title: "Apágala: cada venta sale muy cara",
          why: `Cada venta cuesta ${money(costPerSale)} en anuncios, más del doble de tu meta de ${money(pilot.targetCostPerSale)}.`,
          impact: free,
          ...pauseAction(campaign),
        });
      }
    } else if (spend >= pilot.targetCostPerSale) {
      const landed = campaign.landingViews;
      const lostClicks = campaign.linkClicks >= 40 && landed < campaign.linkClicks * 0.5;
      out.push({
        ...common,
        id: `pause:${campaign.id}`,
        verdict: "pause",
        priority: 82,
        title: "Apágala: ya gastó lo de una venta y no vendió",
        why: `Lleva ${money(spend)} sin ventas; tu meta es ${money(pilot.targetCostPerSale)} por venta. ${
          lostClicks
            ? `De ${formatCount(campaign.linkClicks)} clics solo ${formatCount(landed)} llegaron a cargar la página.`
            : campaign.addToCart === 0 && landed >= 30
              ? `Llegaron ${formatCount(landed)} personas a la web y ninguna agregó al carrito: lo que falla es la página o la oferta, no el anuncio.`
              : ""
        }`,
        impact: free,
        ...pauseAction(campaign),
      });
    } else if (spend > 0) {
      const landed = campaign.landingViews;
      const stuck = campaign.addToCart === 0 && landed >= 50;
      out.push({
        ...common,
        id: `${stuck ? "fix" : "watch"}:${campaign.id}`,
        verdict: stuck ? "fix" : "watch",
        priority: stuck ? 55 : 10,
        title: stuck ? "La gente llega a la web y no agrega al carrito" : "Todavía no hay datos para decidir",
        why: stuck
          ? `Llegaron ${formatCount(landed)} personas a la web${
              campaign.contentViews > 0 ? `, ${formatCount(campaign.contentViews)} vieron un producto` : ""
            } y ninguna agregó al carrito. Cambiar el anuncio no arregla eso.`
          : `Lleva ${money(spend)} de los ${money(pilot.targetCostPerSale)} que vale la pena gastar antes de juzgarla.`,
        impact: stuck ? "Revisa precio, envío y la página a la que llega el anuncio." : "",
      });
    }
  }

  if (campaign.active && frequency >= TIRED_FREQUENCY && !out.some((item) => item.verdict === "pause")) {
    out.push({
      ...common,
      id: `tired:${campaign.id}`,
      verdict: "fix",
      priority: 50,
      title: "Cámbiale el video: el público ya se cansó",
      why: `Cada persona ya la vio ${frequency.toLocaleString("es-CO", { maximumFractionDigits: 1 })} veces en 7 días. A partir de 3,5 el costo empieza a subir.`,
      impact: "Súbele un video nuevo o amplía a quién le llega.",
    });
  }

  return out;
}

function judgeAds(campaign: CampaignRow, context: Context): AdsDecision[] {
  const { money, pilot } = context;
  const out: AdsDecision[] = [];
  const live = campaign.ads.filter((ad) => ad.status === "ACTIVE");
  const adBase = (ad: AdRow) => ({
    level: "ad" as const,
    targetId: ad.id,
    targetName: ad.name,
    campaignName: campaign.name,
    thumbnail: ad.thumbnail,
    isVideo: ad.isVideo,
    dailyBudget: 0,
    evidence: [
      { label: "Gastado en 7 días", value: money(ad.spend) },
      { label: "Chats", value: formatCount(chatsOf(ad)) },
      { label: "Ventas", value: formatCount(salesOf(ad)) },
    ],
  });
  const pause = (ad: AdRow) => ({
    action: { kind: "status" as const, level: "ad" as const, id: ad.id, value: "PAUSED" as const },
    actionLabel: "Pausar anuncio",
  });

  for (const ad of campaign.ads) {
    if (!ad.issue || ad.status === "PAUSED" || ad.status === "ARCHIVED") continue;
    out.push({
      ...adBase(ad),
      id: `issue:${ad.id}`,
      verdict: "fix",
      priority: 88,
      title: "Meta frenó este anuncio",
      why: ad.issue,
      impact: "Mientras no se corrija, no se muestra.",
    });
  }

  // Dentro de una campaña de chats con varios anuncios: apagar el que gasta sin traer o trae al doble.
  if (campaignKind(campaign) !== "chat" || live.length < 2) return out;
  const ranked = live
    .map((ad) => ({ ad, chats: chatsOf(ad) }))
    .filter((row) => row.ad.spend > 0)
    .sort((a, b) => (a.chats ? a.ad.spend / a.chats : Infinity) - (b.chats ? b.ad.spend / b.chats : Infinity));
  const best = ranked[0];
  if (!best || best.chats < 3) return out;
  const bestCost = best.ad.spend / best.chats;
  for (const row of ranked.slice(1)) {
    const enough = row.ad.spend >= Math.max(pilot.minSpendToJudge, pilot.targetCostPerChat * 3);
    if (!enough) continue;
    const cost = row.chats ? row.ad.spend / row.chats : 0;
    if (row.chats === 0 || cost > bestCost * 2) {
      out.push({
        ...adBase(row.ad),
        id: `pause:${row.ad.id}`,
        verdict: "pause",
        priority: 65,
        title: "Pausa este anuncio: hay otro mejor en la misma campaña",
        why:
          row.chats === 0
            ? `Lleva ${money(row.ad.spend)} sin chats. «${best.ad.name}» los trae a ${money(bestCost)}.`
            : `Trae chats a ${money(cost)} y «${best.ad.name}» a ${money(bestCost)}, menos de la mitad.`,
        impact: "El presupuesto de la campaña se va solo al que rinde.",
        ...pause(row.ad),
      });
    }
  }
  return out;
}

function accountDecisions(input: {
  week: AdsReport;
  pulse: CrmPulse;
  context: Context;
  pauses: number;
  capiOk: boolean;
  capiDetail: string;
}): AdsDecision[] {
  const { week, pulse, context } = input;
  const { money } = context;
  const out: AdsDecision[] = [];
  const account = {
    level: "account" as const,
    targetId: "",
    targetName: "",
    campaignName: "",
    thumbnail: "",
    isVideo: false,
    dailyBudget: 0,
    evidence: [],
  };
  const now = Date.now();

  if (pulse.waiting > 0) {
    out.push({
      ...account,
      id: "crm:waiting",
      verdict: "fix",
      priority: 100,
      title: `Responde ${plural(pulse.waiting, "chat que espera", "chats que esperan")} respuesta`,
      why: `${
        pulse.waitingFromAds > 0 ? `${plural(pulse.waitingFromAds, "llegó", "llegaron")} desde un anuncio que ya pagaste. ` : ""
      }El más antiguo escribió ${ago(pulse.oldestAt, now)}. Un chat de anuncio se enfría en minutos.`,
      impact: "Es lo que más rápido convierte gasto en venta.",
    });
  }

  const active = week.campaigns.filter((campaign) => campaign.active);
  const staying = active.length - input.pauses;
  const budget = active.reduce((sum, campaign) => sum + campaign.dailyBudget, 0);
  if (staying >= 3 && budget > 0 && budget / active.length < 25_000) {
    out.push({
      ...account,
      id: "account:spread",
      verdict: "fix",
      priority: 58,
      title: `Junta el presupuesto: ${active.length} campañas es demasiado para ${money(budget)} al día`,
      why: `En promedio cada una tiene ${money(budget / active.length)} al día. Meta necesita unos 50 resultados por semana en un conjunto para aprender, y así ninguna llega.`,
      impact: "Deja una de WhatsApp y, cuando haya ventas web, una de ventas.",
    });
  }

  const media = new Set(
    active.flatMap((campaign) => campaign.ads.filter((ad) => ad.status === "ACTIVE" && ad.mediaId).map((ad) => ad.mediaId)),
  );
  const liveAds = active.reduce((sum, campaign) => sum + campaign.ads.filter((ad) => ad.status === "ACTIVE").length, 0);
  if (media.size === 1 && liveAds >= 3) {
    out.push({
      ...account,
      id: "account:one-video",
      verdict: "fix",
      priority: 52,
      title: "Todos los anuncios usan el mismo video",
      why: `Hay ${formatCount(liveAds)} anuncios activos y todos salen de la misma publicación. El video es lo que más mueve el costo, y así no hay forma de saber cuál funciona mejor.`,
      impact: "Lanza 2 o 3 videos distintos en la misma campaña, desde «Crear».",
    });
  }

  const totals = week.totals;
  const chats = chatsOf(totals);
  const sales = totals.sales + totals.webSales;
  if (chats >= 20 && sales === 0) {
    out.push({
      ...account,
      id: "account:no-close",
      verdict: "fix",
      priority: 62,
      title: "El freno no está en los anuncios: los chats no compran",
      why: `En 7 días llegaron ${formatCount(chats)} chats desde anuncios y ninguno ha pagado.${
        pulse.untouched > 0 ? ` ${plural(pulse.untouched, "sigue", "siguen")} en «Nuevo» en el CRM.` : ""
      } Más presupuesto solo trae más chats sin cerrar.`,
      impact: "Antes de subir gasto, revisa precio, respuesta y seguimiento.",
    });
  }

  if (!input.capiOk && totals.spend > 0) {
    out.push({
      ...account,
      id: "account:capi",
      verdict: "fix",
      priority: 56,
      title: "Meta no está recibiendo tus ventas",
      why: input.capiDetail,
      impact: "Sin eso Meta optimiza a ciegas y el costo por venta no baja.",
    });
  }

  return out;
}

function healthChecks(input: {
  access: AdsAccess;
  hasCapiToken: boolean;
  health: MetaHealth;
  week: AdsReport;
  pulse: CrmPulse;
}): AdsHealthCheck[] {
  const { access, health, week, pulse } = input;
  const now = Date.now();
  const capi = health.capi;
  const messaging = health.messaging;
  const t = week.totals;
  return [
    {
      id: "manage",
      ok: access.canManage,
      label: "Cambiar anuncios desde Mora",
      detail: access.canManage ? "Pausar, activar, cambiar presupuesto y crear ya funciona." : access.missing.join(" "),
    },
    {
      id: "capi",
      ok: Boolean(input.hasCapiToken && capi?.ok),
      label: "Ventas de la web a Meta",
      detail: !input.hasCapiToken
        ? "No hay token para enviar conversiones desde el servidor."
        : !capi
          ? "Aún no se ha enviado ningún evento desde el servidor."
          : capi.ok
            ? `Meta aceptó el último evento (${capi.event}) ${ago(capi.at, now)}.`
            : `Meta rechazó el último evento (${capi.error || "sin detalle"}). En Usuarios del sistema › Asignar activos › Conjuntos de datos, dale el Pixel de Mora con control total al mismo usuario del token.`,
    },
    {
      id: "messaging",
      ok: messaging ? messaging.ok : true,
      label: "Ventas por WhatsApp a Meta",
      detail: !messaging
        ? "Se envía cuando paga alguien que llegó por un anuncio de WhatsApp. Aún no ha pasado."
        : messaging.ok
          ? `Meta aceptó la última (${messaging.event}) ${ago(messaging.at, now)}.`
          : `Meta rechazó la última (${messaging.error || "sin detalle"}). Al generar el token marca también whatsapp_business_manage_events.`,
    },
    {
      id: "funnel",
      ok: !(t.landingViews >= 50 && t.addToCart === 0),
      label: "La web convierte",
      detail:
        t.landingViews === 0
          ? "En 7 días ningún anuncio llevó gente a la web."
          : `En 7 días llegaron ${formatCount(t.landingViews)} personas a la web desde anuncios, ${formatCount(t.contentViews)} vieron un producto y ${formatCount(t.addToCart)} lo agregaron al carrito.`,
    },
    {
      id: "crm",
      ok: pulse.waiting === 0,
      label: "Chats al día",
      detail:
        pulse.waiting === 0
          ? "Ningún chat de venta espera respuesta."
          : `${plural(pulse.waiting, "chat espera", "chats esperan")} respuesta; el más antiguo, ${ago(pulse.oldestAt, now)}.`,
    },
  ];
}

function headline(input: { today: AdsMonitor["today"]; decisions: AdsDecision[]; money: (value: number) => string }) {
  const { today, decisions, money } = input;
  const start =
    today.spend > 0
      ? `Hoy van ${money(today.spend)} gastados, ${plural(today.chats, "chat", "chats")} y ${plural(today.sales, "venta", "ventas")}.`
      : "Hoy todavía no hay gasto.";
  const pauses = decisions.filter((item) => item.verdict === "pause");
  const freed = pauses.reduce((sum, item) => sum + (item.level === "campaign" ? item.dailyBudget : 0), 0);
  const scales = decisions.filter((item) => item.verdict === "scale").length;
  const fixes = decisions.filter((item) => item.verdict === "fix").length;
  const bits = [
    pauses.length ? `apagar ${pauses.length}${freed ? ` (liberas ${money(freed)} al día)` : ""}` : "",
    scales ? `subirle a ${scales}` : "",
    fixes ? `corregir ${plural(fixes, "cosa", "cosas")}` : "",
  ].filter(Boolean);
  if (bits.length === 0) return `${start} Nada urgente: todo lo activo está dentro de tus metas.`;
  return `${start} Por decidir: ${bits.join(", ")}.`;
}

/**
 * «Monitorear campañas ahora»: lee Meta y el CRM en este momento y devuelve
 * decisiones concretas, ordenadas por lo que más plata cuida.
 */
export async function buildAdsMonitor(): Promise<AdsMonitor> {
  const now = Date.now();
  const [today, week, access, pilot, settings, health, pulse] = await Promise.all([
    buildAdsReport("today", { fresh: true }),
    buildAdsReport("7d", { fresh: true }),
    loadAdsAccess({ fresh: true }),
    loadAdsPilotSettings(),
    loadGrowthSettings(),
    loadMetaHealth(),
    loadCrmPulse(now),
  ]);
  const currency = week.currency;
  const money = (value: number) => formatAdsMoney(value, currency);
  const context: Context = { money, pilot, access };

  const active = week.campaigns.filter((campaign) => campaign.active);
  const perCampaign = active.flatMap((campaign) => [...judgeCampaign(campaign, context), ...judgeAds(campaign, context)]);
  // Un anuncio de una campaña que ya se va a apagar no necesita su propia decisión.
  const pausedCampaigns = new Set(
    perCampaign.filter((item) => item.verdict === "pause" && item.level === "campaign").map((item) => item.targetId),
  );
  const campaignOfAd = new Map(active.flatMap((campaign) => campaign.ads.map((ad) => [ad.id, campaign.id] as const)));
  const scoped = perCampaign.filter(
    (item) => item.level !== "ad" || !pausedCampaigns.has(campaignOfAd.get(item.targetId) ?? ""),
  );

  const hasCapiToken = Boolean(settings.metaPixelId && (settings.metaCapiToken || settings.metaAdsToken));
  const checks = healthChecks({ access, hasCapiToken, health, week, pulse });
  const capiCheck = checks.find((check) => check.id === "capi");
  const decisions = [
    ...accountDecisions({
      week,
      pulse,
      context,
      pauses: pausedCampaigns.size,
      capiOk: Boolean(capiCheck?.ok),
      capiDetail: capiCheck?.detail ?? "",
    }),
    ...scoped,
  ]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 14);

  const todayTotals = today.totals;
  const weekTotals = week.totals;
  const weekChats = chatsOf(weekTotals);
  const weekSales = weekTotals.sales + weekTotals.webSales;
  const summary: AdsMonitor["today"] = {
    spend: todayTotals.spend,
    chats: chatsOf(todayTotals),
    sales: todayTotals.sales + todayTotals.webSales,
    dailyBudget: active.reduce((sum, campaign) => sum + campaign.dailyBudget, 0),
    activeCampaigns: active.length,
  };

  return {
    generatedAt: now,
    currency,
    headline: headline({ today: summary, decisions, money }),
    today: summary,
    week: {
      spend: weekTotals.spend,
      chats: weekChats,
      sales: weekSales,
      revenue: weekTotals.revenue + weekTotals.webRevenue,
      costPerChat: weekChats > 0 ? weekTotals.spend / weekChats : 0,
      costPerSale: weekSales > 0 ? weekTotals.spend / weekSales : 0,
    },
    health: checks,
    decisions,
    access,
  };
}
