export const ADS_RANGES = ["today", "7d", "30d", "month"] as const;
export type AdsRange = (typeof ADS_RANGES)[number];

export type AdAccountOption = {
  id: string;
  name: string;
  currency: string;
  active: boolean;
};

export type AdsConnection = {
  connected: boolean;
  accountId: string;
  accountName: string;
  currency: string;
  connectedAt: number;
};

/** Métricas que se repiten en cuenta, campaña, anuncio y día. */
export type AdsMetrics = {
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  /** Conversaciones que Meta cuenta como iniciadas desde el anuncio. */
  chats: number;
  /** Compras que el Pixel le atribuye a Meta. */
  pixelPurchases: number;
  pixelRevenue: number;
  leads: number;
  /** Llegaron a la web (cargó la página), vieron un producto y lo echaron al carrito, según el Pixel. */
  landingViews: number;
  contentViews: number;
  addToCart: number;
  checkouts: number;
};

/** Lo que pasó de verdad en el CRM y en la tienda con la gente de ese anuncio. */
export type AdsOutcome = {
  /** Chats que entraron al CRM con el id de este anuncio. */
  crmChats: number;
  /** De esos chats, cuántos terminaron en pedido pagado. */
  sales: number;
  revenue: number;
};

export type AdRow = AdsMetrics &
  AdsOutcome & {
    id: string;
    name: string;
    status: string;
    statusLabel: string;
    thumbnail: string;
    isVideo: boolean;
    text: string;
    adSetId: string;
    /** Publicación de Instagram de la que salió el anuncio, si aplica. */
    mediaId: string;
    /** Motivo de rechazo o problema que reporta Meta. */
    issue: string;
  };

export type CampaignRow = AdsMetrics &
  AdsOutcome & {
    id: string;
    name: string;
    objective: string;
    objectiveLabel: string;
    status: string;
    statusLabel: string;
    active: boolean;
    /** Presupuesto diario sumado (campaña o conjuntos activos). 0 si no hay. */
    dailyBudget: number;
    /** Presupuesto total de por vida. 0 si no hay. */
    lifetimeBudget: number;
    startTime: string;
    stopTime: string;
    /** Miniatura del anuncio que más gastó, para reconocer la campaña. */
    thumbnail: string;
    isVideo: boolean;
    /** El presupuesto diario vive en la campaña (se puede cambiar desde aquí) y no en los conjuntos. */
    budgetAtCampaign: boolean;
    /** Qué busca Meta en sus conjuntos activos: «CONVERSATIONS», «VISIT_INSTAGRAM_PROFILE»… */
    goals: string[];
    destinations: string[];
    /** La fecha de fin ya pasó aunque Meta la muestre activa. */
    ended: boolean;
    /** Resultado que mejor describe la campaña según su objetivo. */
    /** `per`: el costo es por cada 1 o por cada 1.000 (alcance). */
    result: { label: string; value: number; cost: number; per: 1 | 1000 };
    ads: AdRow[];
  };

export type AdsDay = {
  date: string;
  spend: number;
  chats: number;
  linkClicks: number;
  sales: number;
};

export type AdsNoteTone = "good" | "warn" | "info";

export type AdsNote = {
  tone: AdsNoteTone;
  text: string;
  /** Si la nota habla de un anuncio: su miniatura, para reconocerlo de un vistazo. */
  thumbnail?: string;
  isVideo?: boolean;
};

export type AdsReport = {
  range: AdsRange;
  since: string;
  until: string;
  currency: string;
  accountName: string;
  totals: AdsMetrics &
    AdsOutcome & {
      /** Pedidos pagados en la web que llegaron con clic de Meta (fbclid / utm). */
      webSales: number;
      webRevenue: number;
    };
  campaigns: CampaignRow[];
  days: AdsDay[];
  notes: AdsNote[];
  generatedAt: number;
};

/* ───────────── Administrar desde el panel ───────────── */

/** Qué deja hacer el token conectado. Se calcula contra Meta, no se supone. */
export type AdsAccess = {
  canManage: boolean;
  /** Lo que falta para crear y cambiar anuncios, en lenguaje llano. Vacío si ya se puede. */
  missing: string[];
  /** Mínimo diario que Meta acepta en esta cuenta. */
  minDailyBudget: number;
  checkedAt: number;
};

export type AdsLevel = "campaign" | "adset" | "ad";

export type AdsAction =
  | { kind: "status"; level: AdsLevel; id: string; value: "ACTIVE" | "PAUSED" }
  /** Presupuesto diario de la campaña, en la moneda de la cuenta. */
  | { kind: "budget"; level: "campaign"; id: string; value: number }
  /** Solo para la bitácora: una campaña creada desde Mora. `value` es la receta. */
  | { kind: "create"; level: "campaign"; id: string; value: string };

export type AdsChangeSource = "panel" | "monitor" | "pilot";

/** Bitácora: todo cambio hecho desde Mora queda aquí. */
export type AdsChange = {
  id: string;
  at: number;
  by: string;
  byName: string;
  source: AdsChangeSource;
  action: AdsAction;
  targetName: string;
  before: string;
  after: string;
  reason: string;
  ok: boolean;
  error?: string;
};

/* ───────────── Monitor: decisiones de ahora ───────────── */

export type AdsVerdict = "pause" | "scale" | "fix" | "keep" | "watch";

export type AdsDecision = {
  id: string;
  verdict: AdsVerdict;
  /** Orden: primero lo que más plata cuida o más venta mueve. */
  priority: number;
  level: "account" | AdsLevel;
  targetId: string;
  targetName: string;
  campaignName: string;
  thumbnail: string;
  isVideo: boolean;
  /** Presupuesto diario de la campaña en juego; 0 si la decisión no es de una campaña. */
  dailyBudget: number;
  /** La decisión en una frase: «Apágala». */
  title: string;
  /** Por qué, con cifras. */
  why: string;
  /** Qué se gana: «Liberas $10.000 al día». */
  impact: string;
  evidence: { label: string; value: string }[];
  /** Si se puede aplicar con un clic. */
  action?: AdsAction;
  actionLabel?: string;
};

export type AdsHealthCheck = {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
};

export type AdsMonitor = {
  generatedAt: number;
  currency: string;
  /** Resumen de una frase para decidir. */
  headline: string;
  today: { spend: number; chats: number; sales: number; dailyBudget: number; activeCampaigns: number };
  week: { spend: number; chats: number; sales: number; revenue: number; costPerChat: number; costPerSale: number };
  health: AdsHealthCheck[];
  decisions: AdsDecision[];
  access: AdsAccess;
};

/* ───────────── Segmentación ───────────── */

export type AdsPick = { id: string; name: string };

/** Resultado de buscar un interés: `topic` ayuda a distinguir dos con nombre parecido. */
export type AdsInterestOption = AdsPick & { topic: string };

export type AdsPlace = {
  key: string;
  name: string;
  type: "city" | "region";
  /** «Antioquia», para distinguir ciudades con el mismo nombre. */
  region?: string;
  /** Solo ciudades: radio alrededor, en km (Meta acepta 17–80). 0 = solo la ciudad. */
  radiusKm?: number;
};

export type AdsGender = "all" | "women" | "men";
export type AdsPlacement = "auto" | "instagram" | "facebook";

/**
 * A quién le llega. `strict` decide si Meta debe respetar edad, sexo, intereses
 * y audiencias al pie de la letra, o si son un punto de partida (Advantage+).
 * Los lugares, la edad mínima y las exclusiones siempre se respetan.
 */
export type AdsSegment = {
  /** "country": todo el país. "places": solo las ciudades y regiones elegidas. */
  scope: "country" | "places";
  country: string;
  places: AdsPlace[];
  ageMin: number;
  ageMax: number;
  gender: AdsGender;
  interests: AdsPick[];
  /** Audiencias propias a las que se les muestra. */
  include: AdsPick[];
  /** Audiencias propias que nunca lo ven (p. ej. quienes ya compraron). */
  exclude: AdsPick[];
  strict: boolean;
  placement: AdsPlacement;
};

export type AdsEstimate = {
  /** Personas al mes que caben en la segmentación. 0 si Meta aún no lo calcula. */
  lower: number;
  upper: number;
  ready: boolean;
  /** La segmentación en una frase, tal como se le manda a Meta. */
  summary: string;
  /** Falta algo que impide publicar (p. ej. «solo estas ciudades» sin ciudades). */
  blocked: boolean;
  /** Avisos para corregir antes de gastar. */
  notes: { tone: AdsNoteTone; text: string }[];
};

/* ───────────── Audiencias propias ───────────── */

export type AdsAudienceKind = "list" | "web" | "engagement" | "lookalike";

export type AdsAudienceKey =
  | "customers"
  | "interested"
  | "carts"
  | "web_visitors"
  | "web_cart"
  | "ig_engagers"
  | "like_customers"
  | "like_interested";

export type AdsAudience = {
  key: AdsAudienceKey;
  kind: AdsAudienceKind;
  label: string;
  /** Para qué sirve, en una línea. */
  use: string;
  /** Id en Meta; vacío si aún no se ha creado. */
  id: string;
  /** Personas que Mora tiene para esta lista (solo `list`). */
  local: number;
  /** Tamaño que Meta reporta (su mínimo visible es 1.000). */
  size: number;
  ready: boolean;
  status: string;
  syncedAt: number;
  error: string;
};

/** Audiencia de la cuenta que no creó Mora (p. ej. la que subió la agencia). */
export type AdsForeignAudience = { id: string; name: string; size: number; kind: string };

export type AdsAudiencesState = {
  audiences: AdsAudience[];
  others: AdsForeignAudience[];
  syncedAt: number;
};

/* ───────────── Crear campañas ───────────── */

export type AdsRecipeId = "whatsapp" | "web" | "remarketing_whatsapp" | "remarketing_web";

export type AdsWebEvent = "PURCHASE" | "INITIATED_CHECKOUT" | "ADD_TO_CART";

/** Publicación de Instagram que puede salir como anuncio. */
export type AdsMedia = {
  id: string;
  caption: string;
  thumbnail: string;
  isVideo: boolean;
  permalink: string;
  at: number;
  likes: number;
  comments: number;
  eligible: boolean;
  /** Si ya salió como anuncio: lo que trajo en los últimos 30 días. */
  used?: { spend: number; chats: number; sales: number; ads: number };
};

export type AdsDraftInput = {
  recipe: AdsRecipeId;
  name: string;
  /** Presupuesto diario de la campaña, en la moneda de la cuenta. */
  dailyBudget: number;
  segment: AdsSegment;
  /** Ids de publicaciones de Instagram: un anuncio por cada una (1 a 4). */
  mediaIds: string[];
  /** Solo web: a dónde llega y qué evento busca Meta. */
  link?: string;
  webEvent?: AdsWebEvent;
};

export type AdsCreateOptions = {
  access: AdsAccess;
  currency: string;
  media: AdsMedia[];
  audiences: AdsAudience[];
  others: AdsForeignAudience[];
  defaults: { link: string; dailyBudget: number };
  limits: { minDailyBudget: number; maxDailyPerCampaign: number };
  /** Falta algo de la cuenta para poder crear (página, Instagram, pixel, WhatsApp). */
  blockers: string[];
};

export type AdsCreated = {
  campaignId: string;
  adSetId: string;
  adIds: string[];
  name: string;
};

/* ───────────── Piloto automático ───────────── */

export type AdsPilotSettings = {
  /** Corre solo en la tarea programada. Apagado: solo sugiere. */
  enabled: boolean;
  autoPause: boolean;
  autoScale: boolean;
  /** Tope de presupuesto diario sumando todo lo activo. 0 = sin tope. */
  maxDailyTotal: number;
  maxDailyPerCampaign: number;
  /** Cuánto sube cada vez, en %. */
  scaleStepPct: number;
  /** Lo máximo que vale la pena pagar por un chat y por una venta. */
  targetCostPerChat: number;
  targetCostPerSale: number;
  /** Gasto mínimo antes de juzgar un anuncio. */
  minSpendToJudge: number;
  /** Correo que recibe el resumen diario. Vacío = no se envía. */
  notifyEmail: string;
  updatedAt: number;
};

export type AdsPilotRun = {
  id: string;
  at: number;
  trigger: "schedule" | "manual";
  headline: string;
  applied: { title: string; target: string; ok: boolean; error?: string }[];
  suggested: number;
};
