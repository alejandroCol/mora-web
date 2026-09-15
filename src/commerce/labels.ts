import type { OrderStatus, PaymentMethod, PaymentStatus } from "./types";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Esperando pago",
  paid: "Pedido pagado",
  in_transit: "Pedido en camino",
  delivered: "Pedido entregado",
  cancelled: "Pedido cancelado",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  wompi: "Wompi",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  datafono: "Datáfono",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  declined: "Rechazado",
  voided: "Anulado",
  error: "Error",
};

export const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PA", label: "Pasaporte" },
  { value: "NIT", label: "NIT" },
] as const;
