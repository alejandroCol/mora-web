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
  createdAt: number;
  updatedAt: number;
};

export type WhatsAppConversationStatus =
  | "new"
  | "interested"
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
};

export type WhatsAppMessage = {
  id: string;
  waId?: string;
  direction: "in" | "out";
  type: string;
  text: string;
  at: number;
  status?: string;
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
