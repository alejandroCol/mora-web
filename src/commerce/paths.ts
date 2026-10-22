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
  paymentIntents: "paymentIntents",
  abandonedCarts: "abandonedCarts",
} as const;

export const DOCS = {
  commerce: `${COLLECTIONS.settings}/commerce`,
  productCopy: `${COLLECTIONS.settings}/productCopy`,
  growth: `${COLLECTIONS.settings}/growth`,
  crm: `${COLLECTIONS.settings}/crm`,
  orderCounter: `${COLLECTIONS.counters}/orders`,
  matiasInvoice: `${COLLECTIONS.counters}/matiasInvoice`,
} as const;

export const PENDING_TTL_MS = 45 * 60 * 1000;
export const ORDER_SEQ_START = 1040;
