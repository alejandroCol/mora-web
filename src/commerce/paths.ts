export const COLLECTIONS = {
  settings: "settings",
  inventory: "inventory",
  orders: "orders",
  orderNumbers: "orderNumbers",
  counters: "counters",
  staff: "staff",
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
} as const;

export const DOCS = {
  commerce: `${COLLECTIONS.settings}/commerce`,
  productCopy: `${COLLECTIONS.settings}/productCopy`,
  growth: `${COLLECTIONS.settings}/growth`,
  crm: `${COLLECTIONS.settings}/crm`,
  sales: `${COLLECTIONS.settings}/sales`,
  payments: `${COLLECTIONS.settings}/payments`,
  orderCounter: `${COLLECTIONS.counters}/orders`,
  matiasInvoice: `${COLLECTIONS.counters}/matiasInvoice`,
} as const;

export const PENDING_TTL_MS = 45 * 60 * 1000;
export const ORDER_SEQ_START = 1040;
