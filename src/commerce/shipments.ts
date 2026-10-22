import type { MoraOrder, OrderStatus, ShipmentKind, ShipmentLeg } from "./types";
import { orderHasSizer, orderNeedsSize } from "./sizing";

export function sizerSent(order: MoraOrder) {
  const status = order.shipments?.sizer?.status;
  return status === "in_transit" || status === "delivered" || order.status === "sizer_transit" || order.status === "in_transit";
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
  if (orderHasSizer(order.items) && !order.shipments?.sizer?.hekaGuideId) return "sizer";
  if (orderNeedsSize(order.items)) return null;
  if (orderHasSizer(order.items) && !sizerSent(order)) return null;
  if (!order.shipments?.rings?.hekaGuideId && !ringGuideOnShipping(order)) return "rings";
  return null;
}

function ringGuideOnShipping(order: MoraOrder) {
  const id = order.shipping.hekaGuideId?.trim();
  if (!id) return false;
  return id !== order.shipments?.sizer?.hekaGuideId;
}

export function enCaminoTarget(order: MoraOrder): {
  to: OrderStatus;
  kind: ShipmentKind;
  label: string;
} | null {
  if (order.status === "cancelled" || order.status === "delivered" || order.status === "awaiting_payment") {
    return null;
  }
  if (order.status === "in_transit") return null;
  if (orderHasSizer(order.items) && !sizerSent(order)) {
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

export function legFromShipping(order: MoraOrder, kind: ShipmentKind, status: ShipmentLeg["status"]): ShipmentLeg {
  const current = order.shipments?.[kind];
  const shippingBelongs =
    kind === "rings"
      ? Boolean(order.shipping.hekaGuideId) &&
        order.shipping.hekaGuideId !== order.shipments?.sizer?.hekaGuideId
      : !order.shipments?.rings?.hekaGuideId;
  return {
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
