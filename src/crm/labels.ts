import type {
  CrmDesk,
  CrmLostReason,
  ProductInterest,
  SupportStatus,
  SupportTopic,
  WhatsAppConversationStatus,
} from "@/growth/types";

export const DESK_LABEL: Record<CrmDesk, string> = {
  sales: "Ventas",
  support: "Soporte",
};

export const PIPELINE_LABEL: Record<WhatsAppConversationStatus, string> = {
  new: "Nuevo",
  interested: "Interesado",
  quoted: "Cotizado",
  sold: "Vendido",
  closed: "Cerrado",
};

export const INTEREST_LABEL: Record<ProductInterest, string> = {
  pro: "Mora Pro",
  ultra: "Mora Ultra",
  both: "Pro y Ultra",
  unknown: "Aún no sabe",
};

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Abierto",
  waiting: "Esperando",
  resolved: "Resuelto",
};

export const LOST_REASON_LABEL: Record<CrmLostReason, string> = {
  price: "Precio",
  size: "Talla",
  later: "Después",
  silent: "No contestó",
  other: "Otro",
};

export function isSnoozed(until?: number, now = Date.now()) {
  return (until ?? 0) > now;
}

export function needsReply(item: { lastDirection?: "in" | "out"; snoozedUntil?: number }) {
  return item.lastDirection === "in" && !isSnoozed(item.snoozedUntil);
}

export const SUPPORT_TOPIC_LABEL: Record<SupportTopic, string> = {
  size: "Talla",
  shipping: "Envío",
  warranty: "Garantía",
  app: "App",
  ring: "Anillo",
  payment: "Pago",
  other: "Otro",
};

export const WINDOW_MS = 24 * 60 * 60 * 1000;

export function endOfDay(at = Date.now()) {
  const date = new Date(at);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function startOfDay(at = Date.now()) {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function conversationWindow(lastInboundAt?: number) {
  if (!lastInboundAt) return { open: false, closesAt: null as number | null };
  const closesAt = lastInboundAt + WINDOW_MS;
  return { open: Date.now() < closesAt, closesAt };
}

export function formatWhen(at: number) {
  const diff = Math.max(0, Date.now() - at);
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
  }).format(at);
}

export function formatClock(at: number) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

export function formatDay(at: number) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(at);
}

export function followUpLabel(at: number) {
  const start = startOfDay();
  const end = endOfDay();
  if (at < start) return "Atrasado";
  if (at <= end) return "Hoy";
  if (at <= end + 24 * 60 * 60 * 1000) return "Mañana";
  return formatDay(at);
}
