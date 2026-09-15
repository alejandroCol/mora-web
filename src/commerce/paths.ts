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
} as const;

export const DOCS = {
  commerce: `${COLLECTIONS.settings}/commerce`,
  growth: `${COLLECTIONS.settings}/growth`,
  orderCounter: `${COLLECTIONS.counters}/orders`,
} as const;

export const PENDING_TTL_MS = 45 * 60 * 1000;
export const ORDER_SEQ_START = 1040;
