import type { CrmChannel } from "@/growth/types";
import type { CartLine, OrderItem } from "./types";

/**
 * Regalo: piezas que salen del inventario sin cobro (creadores, prensa, cortesías).
 * No es un pedido: no suma ingresos, no factura y no manda correos.
 * Este archivo es el contrato entre el formulario y `/api/admin/gifts`.
 */

export type GiftStatus = "given" | "voided";

/** A quién se le dio. Con `conversationId` queda ligado a su chat del CRM. */
export type GiftRecipient = {
  name: string;
  /** Usuario, teléfono o cualquier dato para ubicar a la persona. */
  contact?: string;
  conversationId?: string;
  channel?: CrmChannel;
};

export type GiftRecord = {
  id: string;
  status: GiftStatus;
  recipient: GiftRecipient;
  items: OrderItem[];
  /** Valor comercial al precio del día en que se regaló. */
  valueCop: number;
  note?: string;
  createdAt: number;
  createdBy: string;
  createdByName?: string;
  voidedAt?: number;
  voidedBy?: string;
};

export type GiftRequest = {
  items: CartLine[];
  /** Chat del CRM. Si viene, el nombre se toma del chat cuando `name` está vacío. */
  conversationId?: string;
  name?: string;
  contact?: string;
  note?: string;
};

/** Chat que se puede elegir como destinatario. */
export type GiftChat = {
  id: string;
  title: string;
  handle: string;
  channel: CrmChannel;
  creator: boolean;
};

export type GiftContext = {
  /** Unidades libres por referencia de stock (`aero__black__9`, `case__mint`). */
  stock: Record<string, number>;
  chats: GiftChat[];
};

export const GIFT_MAX_PER_LINE = 20;

export function giftPieces(gift: Pick<GiftRecord, "items">) {
  return gift.items.reduce((sum, item) => sum + item.qty, 0);
}
