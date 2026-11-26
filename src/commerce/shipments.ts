import type { MoraOrder, OrderStatus, ShipmentKind, ShipmentLeg } from "./types";
import { orderHasSizer, orderNeedsSize } from "./sizing";

export function sizerSent(order: MoraOrder) {
  const status = order.shipments?.sizer?.status;
  return status === "in_transit" || status === "delivered" || order.status === "sizer_transit" || order.status === "in_transit";
}

/** El medidor todavía cuenta: no ha salido y la talla sigue sin saberse. */
function sizerPending(order: MoraOrder) {
  return orderHasSizer(order.items) && !sizerSent(order) && orderNeedsSize(order.items);
}

/**
 * Con medidor, `order.shipping` arrastra la guía del medidor: la de los anillos
 * solo vale si está en su propio tramo.
 */
function shippingBelongsToRings(order: MoraOrder) {
  if (orderHasSizer(order.items)) return false;
  return Boolean(order.shipping.hekaGuideId?.trim() || order.shipping.trackingNumber?.trim());
}

export function ringsGuideId(order: MoraOrder) {
  return (
    order.shipments?.rings?.hekaGuideId?.trim() ||
    (shippingBelongsToRings(order) ? order.shipping.hekaGuideId?.trim() : "") ||
    ""
  );
}

export function ringsTrackingNumber(order: MoraOrder) {
  return (
    order.shipments?.rings?.trackingNumber?.trim() ||
    (shippingBelongsToRings(order) ? order.shipping.trackingNumber?.trim() : "") ||
    ""
  );
}

export function guideKindFor(order: MoraOrder): ShipmentKind | null {
  if (
    order.status === "cancelled" ||
    order.status === "delivered" ||
    order.status === "awaiting_payment" ||
    order.status === "in_transit"
  ) {
    return null;
  }
  if (sizerPending(order)) return order.shipments?.sizer?.hekaGuideId ? null : "sizer";
  if (orderNeedsSize(order.items)) return null;
  if (!ringsGuideId(order)) return "rings";
  return null;
}

/** Tramo que toca marcar en camino. La guía (creada o escrita a mano) se exige al marcar. */
export function enCaminoTarget(order: MoraOrder): {
  to: OrderStatus;
  kind: ShipmentKind;
  label: string;
} | null {
  if (order.status === "cancelled" || order.status === "delivered" || order.status === "awaiting_payment") {
    return null;
  }
  if (order.status === "in_transit") return null;
  if (sizerPending(order)) {
    return { to: "sizer_transit", kind: "sizer", label: "Medidor en camino" };
  }
  if (orderNeedsSize(order.items)) return null;
  if (order.status === "paid" || order.status === "sizer_transit") {
    return {
      to: "in_transit",
      kind: "rings",
      label: orderHasSizer(order.items) ? "Anillos en camino" : "En camino",
    };
  }
  return null;
}

/** El tramo que toca marcar ya tiene guía creada con Heka o Dropi. */
export function enCaminoHasGuide(order: MoraOrder) {
  const target = enCaminoTarget(order);
  if (!target) return false;
  return target.kind === "sizer" ? Boolean(order.shipments?.sizer?.hekaGuideId) : Boolean(ringsGuideId(order));
}

export function legFromShipping(order: MoraOrder, kind: ShipmentKind, status: ShipmentLeg["status"]): ShipmentLeg {
  const current = order.shipments?.[kind];
  const shippingBelongs = kind === "rings" ? shippingBelongsToRings(order) : !order.shipments?.rings?.hekaGuideId;
  return {
    ...current,
    kind,
    status,
    trackingNumber: current?.trackingNumber || (shippingBelongs ? order.shipping.trackingNumber : undefined),
    hekaGuideId: current?.hekaGuideId || (shippingBelongs ? order.shipping.hekaGuideId : undefined),
    hekaStatus: current?.hekaStatus || (shippingBelongs ? order.shipping.hekaStatus : undefined),
    hekaStatusLabel: current?.hekaStatusLabel || (shippingBelongs ? order.shipping.hekaStatusLabel : undefined),
    carrier: current?.carrier || (shippingBelongs ? order.shipping.carrier : undefined),
    carrierLabel: current?.carrierLabel || (shippingBelongs ? order.shipping.carrierLabel : undefined),
    dispatchedAt: current?.dispatchedAt,
    deliveredAt: current?.deliveredAt,
  };
}
