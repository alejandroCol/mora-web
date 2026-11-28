import { FieldValue } from "firebase-admin/firestore";
import { canAlistar } from "@/commerce/orderTags";
import { COLLECTIONS } from "@/commerce/paths";
import type { MoraOrder } from "@/commerce/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { getOrder } from "./orders";

type Actor = { uid: string; name: string };

function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

/** Pone la etiqueta «Alistado». Solo en pedidos pagados que aún no salen. */
export async function markOrderAlistar(input: { orderId: string; actor: Actor }) {
  const order = await getOrder(input.orderId);
  if (!order) fail("Pedido no encontrado.", 404);
  if (order.alistar) return order;
  if (!canAlistar(order)) fail("Solo se alista un pedido pagado que aún no sale.");
  const patch: Partial<MoraOrder> = {
    alistar: { at: Date.now(), by: input.actor.uid, byName: input.actor.name },
    updatedAt: Date.now(),
  };
  await adminDb().collection(COLLECTIONS.orders).doc(order.id).set(patch, { merge: true });
  return { ...order, ...patch } as MoraOrder;
}

export async function clearOrderAlistar(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) fail("Pedido no encontrado.", 404);
  const now = Date.now();
  await adminDb()
    .collection(COLLECTIONS.orders)
    .doc(order.id)
    .update({ alistar: FieldValue.delete(), updatedAt: now });
  const next = { ...order, updatedAt: now };
  delete next.alistar;
  return next;
}
