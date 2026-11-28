import type { AccessoryId, CaseColorId } from "@/lib/cases";
import type { FinishId, ModelId } from "@/lib/catalog";
import type { InvoiceSnapshot } from "@/invoices/types";
import type { OrderPromo } from "./promos";

export type CatalogId = ModelId | AccessoryId;

export type SizingMethod = "kit" | "self";

export type PaymentMethod = "bold" | "wompi" | "addi" | "transferencia" | "efectivo" | "datafono";
export type PaymentStatus =
  | "pending"
  | "approved"
  | "declined"
  | "voided"
  | "error";
export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "sizer_transit"
  | "in_transit"
  | "delivered"
  | "cancelled";
export type OrderChannel = "online" | "manual" | "whatsapp" | "instagram";
export type ShippingFuente = "heka" | "envia" | "estatico";
export type EnviaCarrier = "coordinadora" | "servientrega" | "deprisa";

export type CartLine = {
  key: string;
  kind?: "ring" | "case";
  modelId: CatalogId;
  finishId: string;
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
  /** Id de la guía en quien la creó: guía de Heka u orden de Dropi (ver `guideProvider`). */
  hekaGuideId?: string;
  hekaStatus?: string;
  hekaStatusLabel?: string;
  guideProvider?: GuideProvider;
  /** Orden ya creada (y cobrada) en Dropi; puede existir antes de que salga la guía. */
  dropiOrderId?: string;
};

/** Quién creó la guía. Sin valor = Heka (pedidos anteriores a Dropi). */
export type GuideProvider = "heka" | "dropi";

export type ShipmentKind = "sizer" | "rings";
export type ShipmentLegStatus = "pending" | "in_transit" | "delivered";

export type ShipmentLeg = {
  kind: ShipmentKind;
  status: ShipmentLegStatus;
  trackingNumber?: string;
  hekaGuideId?: string;
  hekaStatus?: string;
  hekaStatusLabel?: string;
  guideProvider?: GuideProvider;
  dropiOrderId?: string;
  carrier?: string;
  carrierLabel?: string;
  dispatchedAt?: number;
  deliveredAt?: number;
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
  addiApplicationId?: string;
  addiReference?: string;
  addiStatus?: string;
  /** Venta manual: comprobante, número de aprobación o nota del pago. */
  reference?: string;
};

export type OrderTimelineEvent = {
  status: OrderStatus;
  at: number;
  by?: string;
  note?: string;
};

/** Seguimiento de entrega hecho por el equipo. `manual`: se hizo por fuera (llamada, otro chat). */
export type OrderFollowUp = {
  at: number;
  by: string;
  byName?: string;
  via: "whatsapp" | "manual";
  /** Plantilla de Meta enviada, si fue por WhatsApp. */
  template?: string;
  /** Veces que se envió por WhatsApp. */
  count?: number;
};

/** Etiqueta interna de logística: quién la puso y cuándo. El cliente no la ve. */
export type OrderTagMark = {
  at: number;
  by: string;
  byName?: string;
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
  /** Hasta cuándo aplica. Sin fecha (ofertas viejas) no vence. */
  expiresAt?: number;
};

/** Vigencias que el panel puede dar a una oferta de carrito, en horas. */
export const CART_OFFER_HOURS = [12, 24, 48, 120, 168] as const;

/** También se puede escribir un número de horas: entre 1 y 720 (30 días). */
export const CART_OFFER_MAX_HOURS = 720;
export const CART_OFFER_DEFAULT_HOURS = 24;

export function cleanCartOfferHours(raw: unknown) {
  const hours = Math.round(Number(raw));
  if (!Number.isFinite(hours) || hours < 1) return CART_OFFER_DEFAULT_HOURS;
  return Math.min(CART_OFFER_MAX_HOURS, hours);
}

export function cartOfferExpired(offer: Pick<CartOffer, "expiresAt"> | undefined, now = Date.now()) {
  return Boolean(offer?.expiresAt && offer.expiresAt <= now);
}

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
  /** Último correo de recordatorio sin descuento. */
  reminder?: { sentAt: number; sentBy: string; count: number };
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
  shipments?: { sizer?: ShipmentLeg; rings?: ShipmentLeg };
  items: OrderItem[];
  totals: OrderTotals;
  notes?: string;
  timeline: OrderTimelineEvent[];
  emails?: {
    paidSentAt?: number;
    dispatchedSentAt?: number;
    sizerDispatchedSentAt?: number;
    /** Correo «listo para salir», al crear la guía de cada tramo. */
    guideReadySentAt?: number;
    sizerGuideReadySentAt?: number;
    deliveredSentAt?: number;
    cancelledSentAt?: number;
  };
  invoice?: InvoiceSnapshot;
  attribution?: AttributionSnapshot;
  meta?: {
    purchaseEventId?: string;
    cartSessionId?: string;
    /** Código que se mostró en el checkout: de descuento o de carrito recuperado. */
    offerCode?: string;
    /** Solo si `offerCode` es un código de descuento del super admin (cuenta usos). */
    discountCode?: string;
    /** El pedido nació con Black Friday / Hora Loca en vivo. `applied` dice si ese fue su descuento. */
    promo?: OrderPromo;
    /** La compra ya se le reportó a Meta como venta de un anuncio de WhatsApp. */
    messagingPurchaseSent?: boolean;
    /** Venta manual: el vendedor pidió factura electrónica al quedar pagada. */
    invoiceRequested?: boolean;
    /** Venta manual: el cliente paga solo (Bold o Addi) desde la página de su pedido. */
    payLink?: boolean;
    /** Cortesía: mismo pedido que una compra, total en cero. No suma ingresos ni venta. */
    gift?: boolean;
    /**
     * `false`: el pedido espera pago sin apartar stock (enlace aún sin abrir, pago rechazado,
     * apartado vencido). Ausente = apartado, como todos los pedidos anteriores a este campo.
     */
    stockHeld?: boolean;
    /** Hasta cuándo dura el apartado de un pedido que lo tomó al ir a pagar. */
    holdUntil?: number;
    /** Pagó cuando ya no había stock (aprobación tardía): reponer la pieza o reembolsar. */
    oversold?: boolean;
  };
  conversationId?: string;
  followUp?: OrderFollowUp;
  /** Logística: pedido pagado marcado como alistado (etiqueta «Alistado»). */
  alistar?: OrderTagMark;
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
  /** `aero` / `titan` con talla, o `case` por color (sin talla). */
  modelId: CatalogId;
  finishId: FinishId | CaseColorId;
  size?: number;
  units: number;
  reserved: number;
  updatedAt: number;
  managed?: boolean;
};

export type GalleryImage = {
  id: string;
  modelId: ModelId;
  finishId?: FinishId;
  src: string;
  sort: number;
  createdAt: number;
  system?: boolean;
  hidden?: boolean;
  storagePath?: string;
  mime?: string;
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
  /** true = apidev.hekaentrega.co. false = producción. */
  hekaSandbox: boolean;
  favoriteCarrier?: string;
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
  "addi",
  "transferencia",
  "efectivo",
  "datafono",
];

export const ORDER_STATUSES: OrderStatus[] = [
  "awaiting_payment",
  "paid",
  "sizer_transit",
  "in_transit",
  "delivered",
  "cancelled",
];
