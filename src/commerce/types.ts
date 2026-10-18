import type { FinishId, ModelId } from "@/lib/catalog";
import type { InvoiceSnapshot } from "@/invoices/types";

export type SizingMethod = "kit" | "self";

export type PaymentMethod = "bold" | "wompi" | "transferencia" | "efectivo" | "datafono";
export type PaymentStatus =
  | "pending"
  | "approved"
  | "declined"
  | "voided"
  | "error";
export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "in_transit"
  | "delivered"
  | "cancelled";
export type OrderChannel = "online" | "manual" | "whatsapp";
export type ShippingFuente = "envia" | "estatico";
export type EnviaCarrier = "coordinadora" | "servientrega" | "deprisa";

export type CartLine = {
  key: string;
  modelId: ModelId;
  finishId: FinishId;
  size: number;
  sizing: SizingMethod;
  qty: number;
};

export type OrderItem = CartLine & {
  sku: string;
  name: string;
  finishTitle: string;
  unitPrice: number;
  sizedAt?: number;
};

export type CustomerSnapshot = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentType?: string;
  documentNumber?: string;
};

export type ShippingQuoteOption = {
  carrier: string;
  carrierLabel: string;
  service: string;
  serviceDescription?: string;
  totalPriceCop: number;
  deliveryEstimate?: string;
};

export type ShippingSnapshot = {
  departamento: string;
  ciudad: string;
  direccion: string;
  referencia?: string;
  envioCop: number;
  fuente: ShippingFuente;
  carrier?: string;
  carrierLabel?: string;
  service?: string;
  deliveryEstimate?: string;
  trackingNumber?: string;
};

export type PaymentSnapshot = {
  method: PaymentMethod;
  status: PaymentStatus;
  boldTransactionId?: string;
  boldReference?: string;
  boldPaymentType?: string;
  wompiTransactionId?: string;
  wompiReference?: string;
  wompiPaymentType?: string;
};

export type OrderTimelineEvent = {
  status: OrderStatus;
  at: number;
  by?: string;
  note?: string;
};

export type OrderTotals = {
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
};

export type CartOfferKind = "percent" | "amount";

export type AbandonedCartStatus = "open" | "offered" | "recovered" | "dismissed";

export type CartOffer = {
  kind: CartOfferKind;
  value: number;
  code: string;
  discountCop: number;
  offeredAt: number;
  offeredBy?: string;
};

export type AbandonedCart = {
  id: string;
  sessionId: string;
  status: AbandonedCartStatus;
  items: CartLine[];
  customer: Partial<CustomerSnapshot>;
  shipping: Partial<ShippingSnapshot>;
  subtotal: number;
  offer?: CartOffer;
  offerCode?: string;
  recoveredOrderId?: string;
  recoveredOrderNumber?: string;
  createdAt: number;
  updatedAt: number;
};

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

export type MoraOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  channel: OrderChannel;
  payment: PaymentSnapshot;
  customer: CustomerSnapshot;
  shipping: ShippingSnapshot;
  items: OrderItem[];
  totals: OrderTotals;
  notes?: string;
  timeline: OrderTimelineEvent[];
  emails?: { paidSentAt?: number; dispatchedSentAt?: number };
  invoice?: InvoiceSnapshot;
  attribution?: AttributionSnapshot;
  meta?: {
    purchaseEventId?: string;
    cartSessionId?: string;
    offerCode?: string;
  };
  conversationId?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  paidAt?: number;
  dispatchedAt?: number;
  deliveredAt?: number;
  cancelledAt?: number;
  createdBy: string;
};

export type InventoryDoc = {
  sku: string;
  modelId: ModelId;
  finishId: FinishId;
  size?: number;
  units: number;
  reserved: number;
  updatedAt: number;
  managed?: boolean;
};

export type GalleryImage = {
  id: string;
  modelId: ModelId;
  src: string;
  sort: number;
  createdAt: number;
  system?: boolean;
};

export type CityShippingRate = {
  ciudad: string;
  departamento?: string;
  cop: number;
};

export type CommerceSettings = {
  origin: {
    name: string;
    phone: string;
    departamento: string;
    ciudad: string;
    direccion: string;
  };
  package: {
    pesoKg: number;
    largoCm: number;
    anchoCm: number;
    altoCm: number;
  };
  quoteAutomatic: boolean;
  favoriteCarrier?: EnviaCarrier;
  freeShippingFromCop?: number;
  fallbackShippingCop: number;
  cityRates: CityShippingRate[];
  updatedAt: number;
};

export type DailyStats = {
  date: string;
  ordersCount: number;
  revenue: number;
  cancelledCount: number;
  byMethod: Record<PaymentMethod, { count: number; revenue: number }>;
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  "bold",
  "transferencia",
  "efectivo",
  "datafono",
];

export const ORDER_STATUSES: OrderStatus[] = [
  "awaiting_payment",
  "paid",
  "in_transit",
  "delivered",
  "cancelled",
];
