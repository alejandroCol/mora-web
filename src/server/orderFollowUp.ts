import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/commerce/paths";
import { canFollowUp, FOLLOW_UP_TEMPLATE, followUpName } from "@/commerce/followUp";
import type { MoraOrder, OrderFollowUp } from "@/commerce/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadCrmSettings } from "./crm";
import { normalizePhone } from "./metaCapi";
import { getOrder } from "./orders";
import { sendWhatsAppTemplate } from "./whatsapp";

type Actor = { uid: string; name: string };

function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

async function loadFollowUpOrder(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) fail("Pedido no encontrado.", 404);
  if (!canFollowUp(order)) {
    fail("El seguimiento de entrega se hace cuando el pedido ya va en camino o fue entregado.");
  }
  return order;
}

function whenLabel(at: number) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(at);
}

async function saveFollowUp(order: MoraOrder, followUp: OrderFollowUp) {
  const now = Date.now();
  const patch: Partial<MoraOrder> = { followUp, updatedAt: now };
  await adminDb().collection(COLLECTIONS.orders).doc(order.id).set(patch, { merge: true });
  return { ...order, ...patch } as MoraOrder;
}

/**
 * Manda la plantilla «Post-entrega» al WhatsApp del cliente y marca la venta.
 * Sin `force`, no repite si ya se hizo seguimiento.
 */
export async function sendOrderFollowUp(input: { orderId: string; actor: Actor; force?: boolean }) {
  const order = await loadFollowUpOrder(input.orderId);
  if (order.followUp && !input.force) {
    fail(`Ya se le hizo seguimiento el ${whenLabel(order.followUp.at)}.`, 409);
  }
  const phone = normalizePhone(order.customer.phone ?? "");
  if (phone.length < 10) fail("El pedido no tiene un celular válido para escribirle por WhatsApp.");
  const name = followUpName(order);
  if (!name) fail("El pedido no tiene nombre del cliente. Sin nombre, Meta no envía la plantilla.");

  const settings = await loadCrmSettings();
  const registered = settings.templates.find((item) => item.name === FOLLOW_UP_TEMPLATE.name);
  const variables = registered?.variables ?? FOLLOW_UP_TEMPLATE.variables;
  try {
    await sendWhatsAppTemplate({
      phone,
      name: FOLLOW_UP_TEMPLATE.name,
      language: registered?.language || FOLLOW_UP_TEMPLATE.language,
      params: Array.from({ length: variables }, () => name),
      preview: registered?.body || FOLLOW_UP_TEMPLATE.body,
      billingCategory: registered?.billingCategory ?? FOLLOW_UP_TEMPLATE.billingCategory,
      by: input.actor.uid,
      byName: input.actor.name,
      claim: settings.autoClaimOnReply,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = (error as { status?: number }).status ?? 400;
    if (status === 503) throw error;
    fail(
      `WhatsApp no envió el seguimiento${message ? `: ${message}` : "."} Revisa que la plantilla «${FOLLOW_UP_TEMPLATE.name}» esté aprobada en Meta.`,
      status,
    );
  }

  return saveFollowUp(order, {
    at: Date.now(),
    by: input.actor.uid,
    byName: input.actor.name,
    via: "whatsapp",
    template: FOLLOW_UP_TEMPLATE.name,
    count: (order.followUp?.count ?? 0) + 1,
  });
}

/** Marca la venta como seguida sin enviar nada (se habló por llamada u otro chat). */
export async function markOrderFollowUp(input: { orderId: string; actor: Actor }) {
  const order = await loadFollowUpOrder(input.orderId);
  if (order.followUp) return order;
  return saveFollowUp(order, {
    at: Date.now(),
    by: input.actor.uid,
    byName: input.actor.name,
    via: "manual",
  });
}

/** Quita la etiqueta. El mensaje ya enviado sigue en el chat. */
export async function clearOrderFollowUp(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) fail("Pedido no encontrado.", 404);
  const now = Date.now();
  await adminDb()
    .collection(COLLECTIONS.orders)
    .doc(order.id)
    .update({ followUp: FieldValue.delete(), updatedAt: now });
  const next = { ...order, updatedAt: now };
  delete next.followUp;
  return next;
}
