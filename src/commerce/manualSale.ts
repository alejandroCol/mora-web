import type {
  AttributionSnapshot,
  CartLine,
  OrderChannel,
  PaymentMethod,
  ShippingQuoteOption,
} from "./types";

/**
 * Venta manual del super admin: el mismo pedido que crea la tienda, armado por el equipo.
 * Este archivo es el contrato entre el formulario y `/api/admin/orders`.
 */

export type ManualPayMethod = Exclude<PaymentMethod, "wompi">;

export const MANUAL_PAY_METHODS: ManualPayMethod[] = [
  "transferencia",
  "efectivo",
  "datafono",
  "bold",
  "addi",
];

export const MANUAL_PAY_LABEL: Record<ManualPayMethod, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  datafono: "Datáfono",
  bold: "Link de pago",
  addi: "Addi",
};

/**
 * Cuánto vive una venta manual por cobrar. Por transferencia aparta el stock todo ese tiempo;
 * un enlace (Bold o Addi) solo lo aparta cuando el cliente va a pagar.
 */
export const MANUAL_PENDING_TTL_MS = 72 * 60 * 60 * 1000;
export const MANUAL_PENDING_HOURS = 72;

/** Medios que el cliente paga solo, desde un enlace. */
export function isLinkMethod(method: PaymentMethod) {
  return method === "bold" || method === "addi";
}

/** El cliente paga desde la página de su pedido. */
export function payLinkPath(orderNumber: string) {
  return `/pedido/${encodeURIComponent(orderNumber.trim().toUpperCase())}`;
}

export type ManualDelivery =
  | { mode: "pickup" }
  | {
      mode: "ship";
      departamento: string;
      ciudad: string;
      direccion: string;
      referencia?: string;
      /** Transportadora elegida entre las opciones cotizadas. */
      carrier?: string;
      /** Cortesía: se envía pero no se cobra. */
      free?: boolean;
    };

export type ManualSaleRequest = {
  items: CartLine[];
  customer: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    documentType?: string;
    documentNumber?: string;
  };
  delivery: ManualDelivery;
  payment: {
    method: ManualPayMethod;
    /** true = el dinero ya entró. false = el pedido queda esperando el pago. */
    paid: boolean;
    /** Comprobante, número de aprobación o nota del pago. */
    reference?: string;
  };
  /** Emitir factura electrónica cuando el pedido quede pagado. */
  invoice?: boolean;
  discountCop?: number;
  notes?: string;
  channel?: Exclude<OrderChannel, "online">;
  conversationId?: string;
  attribution?: AttributionSnapshot;
};

export type ManualSaleContext = {
  /** Unidades libres por referencia de stock (`aero__black__9`, `case__mint`). */
  stock: Record<string, number>;
  /** El link de pago (Bold) está configurado. */
  bold: boolean;
  addi: boolean;
  /** La facturación electrónica está configurada. */
  invoice: boolean;
  /** Black Friday / Hora Loca en vivo: la venta la descuenta sola, como la tienda. */
  promo?: { label: string; percent: number } | null;
  /** Quién tiene apartada cada referencia mientras paga. */
  holds?: Record<string, ManualStockHold[]>;
};

export type ManualStockHold = {
  orderId: string;
  orderNumber: string;
  customer: string;
  method: PaymentMethod;
  channel: OrderChannel;
  qty: number;
  until: number | null;
};

/** Gana el mayor entre el descuento a mano y la promoción; en empate, la promoción. */
export function manualDiscountOf(subtotal: number, manualCop: number, promoCop: number) {
  const manual = Math.min(subtotal, Math.max(0, Math.round(manualCop) || 0));
  const promoApplied = promoCop > 0 && promoCop >= manual;
  return { discountCop: promoApplied ? promoCop : manual, promoApplied };
}

export type ManualQuote = {
  envioCop: number;
  gratis: boolean;
  fuente: "heka" | "envia" | "estatico";
  seleccionada: ShippingQuoteOption | null;
  opciones: ShippingQuoteOption[];
};

export function looksLikeEmail(value: string | undefined) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value ?? "").trim());
}
