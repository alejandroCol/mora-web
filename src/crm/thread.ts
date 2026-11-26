import type { WhatsAppMessage } from "@/growth/types";

/** Mensajes al abrir un chat y en cada refresco. */
export const THREAD_PAGE = 40;
/** Mensajes por página al subir en el hilo. */
export const THREAD_OLDER_PAGE = 60;

function byTime(a: WhatsAppMessage, b: WhatsAppMessage) {
  return a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Une lo que ya está en pantalla con una página nueva. La versión nueva de un
 * mensaje gana: así llegan los cambios de estado (entregado, leído) y las reacciones.
 */
export function mergeMessages(current: WhatsAppMessage[], incoming: WhatsAppMessage[]) {
  if (!incoming.length) return current;
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(byTime);
}

/**
 * La página reciente empieza después de lo que hay en pantalla: entre medio
 * llegaron más mensajes de los que caben en una página (p. ej. tras horas con
 * la pestaña oculta). Unirlas dejaría un hueco; hay que empezar de esa página.
 */
export function leavesGap(current: WhatsAppMessage[], latest: WhatsAppMessage[], latestHasMore: boolean) {
  if (!current.length || !latest.length || !latestHasMore) return false;
  const oldest = latest[0];
  if (current.some((message) => message.id === oldest.id)) return false;
  return current[current.length - 1].at <= oldest.at;
}
