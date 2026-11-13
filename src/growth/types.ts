export type AttributionSnapshot = {
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landing?: string;
};

export type MetaStandardEvent =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Lead"
  | "Contact"
  | "Purchase"
  | "CompleteRegistration";

export type GrowthEventPayload = {
  content_ids?: string[];
  content_name?: string;
  content_type?: string;
  content_category?: string;
  value?: number;
  currency?: string;
  num_items?: number;
  order_id?: string;
};

export type LeadSource = "whatsapp" | "checkout" | "site" | "ad" | "instagram";
export type LeadStatus = "new" | "interested" | "sold" | "closed";
/** `creators`: creadoras de contenido. No es venta: no crea leads ni avisa a Meta. */
export type CrmDesk = "sales" | "support" | "creators";
/** Por dónde se habla con la persona. Sin dato = WhatsApp (conversaciones anteriores a Instagram). */
export type CrmChannel = "whatsapp" | "instagram";
export type ProductInterest = "pro" | "ultra" | "both" | "unknown";
export type SupportTopic =
  | "size"
  | "shipping"
  | "warranty"
  | "app"
  | "ring"
  | "payment"
  | "other";
export type SupportStatus = "open" | "waiting" | "resolved";

export type MoraLead = {
  id: string;
  source: LeadSource;
  name: string;
  email: string;
  phone: string;
  /** Id de la persona en Instagram (leads que llegan por DM, aún sin teléfono). */
  igUserId?: string;
  igUsername?: string;
  attribution?: AttributionSnapshot;
  lastEvent: string;
  status: LeadStatus;
  conversationId?: string;
  orderId?: string;
  orderNumber?: string;
  assignedTo?: string;
  assignedName?: string;
  createdAt: number;
  updatedAt: number;
};

export type WhatsAppConversationStatus =
  | "new"
  | "interested"
  | "quoted"
  | "sold"
  | "closed";

export type CrmLostReason = "price" | "size" | "later" | "silent" | "other";

/**
 * Origen Click-to-WhatsApp que Meta adjunta al primer mensaje que llega desde
 * un anuncio o una publicación con botón «Enviar mensaje».
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components#referral-object
 */
export type WhatsAppReferral = {
  /** Link al anuncio o publicación de Facebook/Instagram. */
  sourceUrl?: string;
  /** Id del anuncio (o del post) en Meta. */
  sourceId?: string;
  /**
   * "ad" (anuncio pagado), "post" (publicación con botón) o "comment"
   * (comentó en Instagram y una automatización le escribió por DM).
   */
  sourceType?: string;
  /** Título del anuncio. */
  headline?: string;
  /** Texto principal del anuncio. */
  body?: string;
  /** "image" o "video". */
  mediaType?: string;
  /** Creativo del anuncio. URLs del CDN de Meta: pueden caducar. */
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  ctwaClid?: string;
  /** Cuándo llegó el mensaje con este referral (ms). */
  at?: number;
};

/**
 * Conversación del CRM. El nombre viene de cuando solo había WhatsApp; hoy
 * también guarda las de Instagram (`channel: "instagram"`, id `ig_…`).
 */
export type WhatsAppConversation = {
  id: string;
  channel?: CrmChannel;
  /** WhatsApp: siempre. Instagram: vacío hasta que el vendedor lo vincula. */
  phone: string;
  /** Solo Instagram: id de la persona para esta cuenta y su usuario público. */
  igUserId?: string;
  igUsername?: string;
  name: string;
  email?: string;
  lastMessage: string;
  lastDirection: "in" | "out";
  lastAt: number;
  unread: number;
  status: WhatsAppConversationStatus;
  source: "organic" | "ad" | "site";
  referral?: WhatsAppReferral;
  attribution?: AttributionSnapshot;
  leadId?: string;
  orderId?: string;
  orderNumber?: string;
  assignedTo?: string;
  assignedName?: string;
  assignedAt?: number;
  desk?: CrmDesk;
  interest?: ProductInterest;
  city?: string;
  nextFollowUpAt?: number;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  supportStatus?: SupportStatus;
  supportTopic?: SupportTopic;
  pinned?: boolean;
  snoozedUntil?: number;
  lostReason?: CrmLostReason;
};

export type WhatsAppBillingCategory = "marketing" | "utility" | "authentication" | "service";

export type WhatsAppMessage = {
  id: string;
  waId?: string;
  direction: "in" | "out";
  type: string;
  text: string;
  at: number;
  status?: string;
  /** WhatsApp: id del archivo en Meta (se pide a la Cloud API al abrirlo). */
  mediaId?: string;
  /** Instagram: ruta del archivo en nuestro Storage (Meta solo da enlaces que caducan). */
  mediaPath?: string;
  mimeType?: string;
  /** Instagram: enlace a lo que compartió (publicación, reel, historia). */
  linkUrl?: string;
  linkLabel?: string;
  billingCategory?: WhatsAppBillingCategory;
  templateName?: string;
  by?: string;
  /** Emoji con el que el cliente reaccionó a este mensaje ("" si la quitó). */
  reaction?: string;
  /** En mensajes `type: "reaction"`: id del mensaje al que reaccionó. */
  reactionTo?: string;
  /** Solo en el mensaje que entró desde un anuncio o publicación. */
  referral?: WhatsAppReferral;
};

export type WhatsAppUsageCategoryRow = {
  count: number;
  unitUsd: number;
  subtotalUsd: number;
};

export type WhatsAppUsageReport = {
  monthKey: string;
  monthLabel: string;
  timezone: "America/Bogota";
  updatedAt: number;
  source: "firestore_estimate";
  policyNote: string;
  totals: {
    inbound: number;
    outboundDelivered: number;
    estimatedUsd: number;
    estimatedCop: number;
  };
  freeAllowance: {
    servicePerMonth: number;
    serviceUsed: number;
    serviceRemaining: number;
    serviceBillingEffectiveFrom: string;
  };
  byCategory: {
    marketing: WhatsAppUsageCategoryRow;
    utility: WhatsAppUsageCategoryRow;
    authentication: WhatsAppUsageCategoryRow;
    service: WhatsAppUsageCategoryRow;
    free_service_tier: WhatsAppUsageCategoryRow;
    free_ctwa: WhatsAppUsageCategoryRow;
  };
  rates: {
    market: "CO";
    copPerUsd: number;
    effectiveQuarter: string;
  };
  docUrl: string;
};

export type CrmNote = {
  id: string;
  phone: string;
  text: string;
  by: string;
  byName: string;
  at: number;
  kind: "note" | "system";
};

export type CrmQuickReply = {
  id: string;
  title: string;
  body: string;
  desk: CrmDesk | "both";
};

export type CrmTemplate = {
  id: string;
  name: string;
  language: string;
  label: string;
  desk: CrmDesk | "both";
  billingCategory?: "marketing" | "utility" | "authentication";
  /** Variables `{{n}}` del cuerpo en Meta. 0 = texto fijo (por defecto). */
  variables?: number;
  /** Texto aprobado en Meta, para mostrarlo en el hilo y en Ajustes. */
  body?: string;
};

export type CrmSettings = {
  replies: CrmQuickReply[];
  templates: CrmTemplate[];
  autoClaimOnReply: boolean;
  updatedAt: number;
};

export type CrmSeller = {
  uid: string;
  name: string;
  role: string;
};

export type CrmCounts = {
  unread: number;
  unassigned: number;
  followUpDue: number;
  supportOpen: number;
  mine: number;
  waitingOnUs: number;
};

export type GrowthSettings = {
  metaPixelId: string;
  metaCapiToken: string;
  metaCapiTestEventCode: string;
  googleSiteVerification: string;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  whatsappVerifyToken: string;
  whatsappAppSecret: string;
  whatsappDisplayNumber: string;
  whatsappWelcome: string;
  whatsappPrefill: string;
  /** Instagram: lo llena «Conectar» en Automatizaciones, no se escribe a mano. */
  instagramAccessToken: string;
  instagramPageId: string;
  instagramPageName: string;
  instagramAccountId: string;
  instagramUsername: string;
  instagramConnectedAt: number;
  /** Permiso «Human Agent» de Meta aprobado: deja responder hasta 7 días después. */
  instagramHumanAgent: boolean;
  /** Anuncios de Meta: lo llena «Conectar» en Anuncios (token con `ads_read`). */
  metaAdsToken: string;
  /** `act_…` */
  metaAdAccountId: string;
  metaAdAccountName: string;
  metaAdsCurrency: string;
  metaAdsConnectedAt: number;
  updatedAt: number;
};

export type PublicGrowthConfig = {
  pixelId: string;
  whatsappDisplayNumber: string;
  whatsappPrefill: string;
};
