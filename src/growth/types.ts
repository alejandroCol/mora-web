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

export type LeadSource = "whatsapp" | "checkout" | "site" | "ad";
export type LeadStatus = "new" | "interested" | "sold" | "closed";
export type CrmDesk = "sales" | "support";
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

export type WhatsAppReferral = {
  sourceUrl?: string;
  sourceId?: string;
  sourceType?: string;
  headline?: string;
  body?: string;
  ctwaClid?: string;
};

export type WhatsAppConversation = {
  id: string;
  phone: string;
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
};

export type WhatsAppMessage = {
  id: string;
  waId?: string;
  direction: "in" | "out";
  type: string;
  text: string;
  at: number;
  status?: string;
  mediaId?: string;
  mimeType?: string;
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
  updatedAt: number;
};

export type PublicGrowthConfig = {
  pixelId: string;
  whatsappDisplayNumber: string;
  whatsappPrefill: string;
};
