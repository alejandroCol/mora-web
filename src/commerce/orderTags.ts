import { ringsGuideId } from "./shipments";
import { orderGuides } from "./tracking";
import type { MoraOrder } from "./types";

/** Pagado y sin salir: el anillo (o el medidor) está por empacar. */
export function canAlistar(order: MoraOrder) {
  return order.status === "paid" || order.status === "sizer_transit";
}

/** Hay guía creada en la transportadora o escrita a mano, de cualquier tramo. */
export function hasGuide(order: MoraOrder) {
  return Boolean(
    order.shipments?.sizer?.hekaGuideId || ringsGuideId(order) || orderGuides(order).length > 0,
  );
}
