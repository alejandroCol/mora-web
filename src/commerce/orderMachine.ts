import type { OrderStatus } from "./types";

const FLOW: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ["paid", "cancelled"],
  paid: ["sizer_transit", "in_transit", "cancelled"],
  sizer_transit: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return FLOW[from].includes(to);
}

export type TrackingStepKey =
  | "created"
  | "paid"
  | "sizer_transit"
  | "size_chosen"
  | "in_transit"
  | "delivered";

export type TrackingStep = {
  key: TrackingStepKey;
  label: string;
  description: string;
  done: boolean;
};

const RANK: Record<Exclude<OrderStatus, "cancelled">, number> = {
  awaiting_payment: 0,
  paid: 1,
  sizer_transit: 2,
  in_transit: 3,
  delivered: 4,
};

/** Con medidor hay dos pasos más: el medidor viaja y nos cuentan la talla. */
export function trackingSteps(order: {
  status: OrderStatus;
  hasSizer?: boolean;
  needsSize?: boolean;
  sizerStatus?: string | null;
  deliveryLabel?: string;
}): TrackingStep[] {
  const rank = order.status === "cancelled" ? -1 : RANK[order.status];
  const paid = rank >= RANK.paid;
  const paidDescription = order.deliveryLabel
    ? `Tu pago quedó aprobado. Tu anillo llega el ${order.deliveryLabel}.`
    : "Tu pago quedó aprobado.";

  const steps: TrackingStep[] = [
    {
      key: "created",
      label: "Pedido creado",
      description: paid
        ? "Recibimos tu pedido."
        : "Recibimos tu pedido y estamos confirmando tu pago.",
      done: rank >= 0,
    },
    { key: "paid", label: "Pedido pagado", description: paidDescription, done: paid },
  ];

  if (order.hasSizer) {
    const sizerOut =
      rank >= RANK.sizer_transit ||
      order.sizerStatus === "in_transit" ||
      order.sizerStatus === "delivered";
    steps.push(
      {
        key: "sizer_transit",
        label: "Medidor en camino",
        description: "Te enviamos el medidor para que encuentres tu talla en casa.",
        done: sizerOut,
      },
      {
        key: "size_chosen",
        label: "Nos cuentas tu talla",
        description: "Pruébatelo con calma y elige tu número con este pedido.",
        done: paid && !order.needsSize,
      },
    );
  }

  steps.push(
    {
      key: "in_transit",
      label: order.hasSizer ? "Anillo en camino" : "Pedido en camino",
      description: "Tu anillo ya va hacia ti. Puedes seguirlo con la guía.",
      done: rank >= RANK.in_transit,
    },
    {
      key: "delivered",
      label: "Pedido entregado",
      description: "Llegó a tus manos. Gracias por elegir Mora Ring.",
      done: rank >= RANK.delivered,
    },
  );
  return steps;
}
