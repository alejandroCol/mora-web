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
  /**
   * WhatsApp: el teléfono, o el id de usuario (`CO.1349…`) si escribe con nombre
   * de usuario y Meta no da el número. Instagram: vacío hasta que el vendedor lo vincula.
   */
  phone: string;
  /** WhatsApp: id de usuario de Meta (BSUID); llega aunque falte el teléfono. */
  waUserId?: string;
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
  /** Hasta qué mensaje entrante se dejó de mostrar arriba. Uno más nuevo vuelve a subir. */
  replyIgnoredAt?: number;
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
  /** Nombre del archivo en documentos; `text` queda para el pie. */
  fileName?: string;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  /** Tarjetas de contacto que compartió. */
  contacts?: { name: string; phones: string[] }[];
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
  /** Id del mensaje al que responde (deslizar para responder). */
  replyTo?: string;
  /** Copia corta del mensaje citado, por si el original no está en la página cargada. */
  quote?: WhatsAppQuote;
  /** Solo en el mensaje que entró desde un anuncio o publicación. */
  referral?: WhatsAppReferral;
};

export type WhatsAppQuote = {
  /** "" si el original no está en el CRM (p. ej. se escribió desde el teléfono). */
  text: string;
  direction?: "in" | "out";
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

export type CrmQuickReplyMedia = {
  kind: "image" | "video";
  /** Original en Storage (`crm/replies/…`): solo se lee para volver a subirlo a Meta. */
  path: string;
  mimeType: string;
  name?: string;
  /** Id en Meta, reutilizable hasta que caduca (30 días): enviar no relee Storage. */
  waMediaId?: string;
  waUploadedAt?: number;
};

export type CrmQuickReply = {
  id: string;
  title: string;
  body: string;
  desk: CrmDesk | "both";
  media?: CrmQuickReplyMedia;
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
