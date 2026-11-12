export const COLLECTIONS = {
  settings: "settings",
  inventory: "inventory",
  orders: "orders",
  orderNumbers: "orderNumbers",
  counters: "counters",
  staff: "staff",
  /** Teléfonos del equipo con la app Super Admin (push de la bandeja). Solo Admin SDK. */
  staffDevices: "staffDevices",
  statsDaily: "statsDaily",
  gallery: "gallery",
  leads: "leads",
  whatsappConversations: "whatsappConversations",
  financeExpenses: "financeExpenses",
  financeLoans: "financeLoans",
  financeOrders: "financeOrders",
  financeAttachments: "financeAttachments",
  encuestaVotes: "encuestaVotes",
  creatorApplications: "creatorApplications",
  paymentIntents: "paymentIntents",
  abandonedCarts: "abandonedCarts",
  insightsDaily: "insightsDaily",
  insightsSeen: "insightsSeen",
  supportTickets: "supportTickets",
  /** Códigos de descuento del super admin. Solo Admin SDK. */
  discountCodes: "discountCodes",
  /** Feature flags de las apps (`featureFlags/{key}`). Las edita Developer; las lee la Function `appConfig`. */
  featureFlags: "featureFlags",
  /** Códigos que regalan un espíritu en la app (`spiritCodes/{CODE}`). Solo Admin SDK. */
  spiritCodes: "spiritCodes",
  /** Reglas «comentan X en Instagram → DM». Solo Admin SDK. */
  instagramAutomations: "instagramAutomations",
  /** Comentarios que dispararon una regla (`{id del comentario}`): historial y antirrepetición. Solo Admin SDK. */
  instagramCommentEvents: "instagramCommentEvents",
} as const;

export const DOCS = {
  commerce: `${COLLECTIONS.settings}/commerce`,
  productCopy: `${COLLECTIONS.settings}/productCopy`,
  growth: `${COLLECTIONS.settings}/growth`,
  crm: `${COLLECTIONS.settings}/crm`,
  sales: `${COLLECTIONS.settings}/sales`,
  payments: `${COLLECTIONS.settings}/payments`,
  rings: `${COLLECTIONS.settings}/rings`,
  /** Precios vivos de Pro, Ultra y Case. */
  pricing: `${COLLECTIONS.settings}/pricing`,
  orderCounter: `${COLLECTIONS.counters}/orders`,
  matiasInvoice: `${COLLECTIONS.counters}/matiasInvoice`,
} as const;

export const PENDING_TTL_MS = 45 * 60 * 1000;
export const ORDER_SEQ_START = 1040;
