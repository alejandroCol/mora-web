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
