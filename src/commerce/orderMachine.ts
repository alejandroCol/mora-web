import type { OrderStatus } from "./types";

const FLOW: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ["paid", "cancelled"],
  paid: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return FLOW[from].includes(to);
}

export function fulfillmentIndex(status: OrderStatus) {
  if (status === "cancelled") return -1;
  if (status === "awaiting_payment") return 0;
  if (status === "paid") return 1;
  if (status === "in_transit") return 2;
  return 3;
}

export const TRACKING_STEPS: {
  status: Exclude<OrderStatus, "cancelled">;
  label: string;
  description: string;
}[] = [
  {
    status: "awaiting_payment",
    label: "Pedido creado",
    description: "Recibimos tu pedido y estamos confirmando el pago.",
  },
  {
    status: "paid",
    label: "Pedido pagado",
    description: "El pago quedó aprobado. Preparamos tu anillo en el atelier.",
  },
  {
    status: "in_transit",
    label: "Pedido en camino",
    description: "Ya salió de Mora. Puedes seguir la guía de la transportadora.",
  },
  {
    status: "delivered",
    label: "Pedido entregado",
    description: "Llegó a destino. Gracias por llevar Mora.",
  },
];
