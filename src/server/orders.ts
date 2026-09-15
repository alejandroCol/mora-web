import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, DOCS, ORDER_SEQ_START, PENDING_TTL_MS } from "@/commerce/paths";
import { demandBySku, totalsOf } from "@/commerce/cartMath";
import { canTransition } from "@/commerce/orderMachine";
import { lineToOrderItem } from "@/commerce/sku";
import type {
  AttributionSnapshot,
  CartLine,
  CustomerSnapshot,
  MoraOrder,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ShippingSnapshot,
} from "@/commerce/types";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  consumeReservation,
  consumeWithoutReservation,
  demandFromItems,
  releaseReservation,
  assertAndReserve,
} from "./inventory";
import {
  sendDispatchedCustomerEmail,
  sendPaidCustomerEmail,
  sendPaidStaffEmail,
} from "./email";
import { bumpDailyStats } from "./stats";
import { formatoDepartamentoEtiqueta } from "@/lib/colombiaGeo";
import { markLeadSold } from "./leads";
import { sendMetaEvent } from "./metaCapi";
import { updateConversation } from "./whatsapp";

function orderRef(db: Firestore, id: string) {
  return db.collection(COLLECTIONS.orders).doc(id);
}

export function serializeOrder(id: string, data: DocumentData): MoraOrder {
  return { id, ...(data as Omit<MoraOrder, "id">) };
}

async function nextOrderNumber(db: Firestore) {
  const counterRef = db.doc(DOCS.orderCounter);
  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists
      ? Number((snap.data() as { seq?: number }).seq ?? ORDER_SEQ_START)
      : ORDER_SEQ_START;
    const next = current + 1;
    tx.set(counterRef, { seq: next }, { merge: true });
    return next;
  });
  return `MORA-${seq}`;
}

export async function releaseExpiredCheckouts() {
  const db = adminDb();
  const now = Date.now();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("status", "==", "awaiting_payment")
    .where("expiresAt", "<=", now)
    .limit(25)
    .get();

  for (const doc of snap.docs) {
    const order = serializeOrder(doc.id, doc.data());
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      const data = fresh.data();
      if (!data || data.status !== "awaiting_payment") return;
      tx.update(doc.ref, {
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
        timeline: [
          ...(data.timeline ?? []),
          { status: "cancelled", at: now, note: "Checkout expirado" },
        ],
      });
    });
    await releaseReservation(db, demandFromItems(order.items)).catch(() => undefined);
  }
}

export async function createPendingOrder(input: {
  items: CartLine[];
  customer: CustomerSnapshot;
  shipping: ShippingSnapshot;
  notes?: string;
  wompiReference: string;
  attribution?: AttributionSnapshot;
}): Promise<MoraOrder> {
  await releaseExpiredCheckouts();
  const db = adminDb();
  const orderItems = input.items.map(lineToOrderItem);
  const demand = demandBySku(input.items);
  await assertAndReserve(db, demand);

  const totals = totalsOf(orderItems, input.shipping.envioCop);
  const now = Date.now();
  const ref = db.collection(COLLECTIONS.orders).doc();
  const orderNumber = await nextOrderNumber(db);
  const order: MoraOrder = {
    id: ref.id,
    orderNumber,
    status: "awaiting_payment",
    channel: "online",
    payment: {
      method: "wompi",
      status: "pending",
      wompiReference: input.wompiReference,
    },
    customer: input.customer,
    shipping: input.shipping,
    items: orderItems,
    totals,
    notes: input.notes,
    attribution: input.attribution,
    timeline: [{ status: "awaiting_payment", at: now }],
    createdAt: now,
    updatedAt: now,
    expiresAt: now + PENDING_TTL_MS,
    createdBy: "checkout",
  };

  await ref.set(order);
  await db
    .collection(COLLECTIONS.orderNumbers)
    .doc(orderNumber)
    .set({ orderId: ref.id, createdAt: now });
  return order;
}

export async function createManualOrder(input: {
  items: CartLine[];
  customer: CustomerSnapshot;
  shipping: ShippingSnapshot;
  paymentMethod: Exclude<PaymentMethod, "wompi">;
  notes?: string;
  createdBy: string;
  skipStock?: boolean;
  channel?: Exclude<OrderChannel, "online">;
  conversationId?: string;
  attribution?: AttributionSnapshot;
}): Promise<MoraOrder> {
  const db = adminDb();
  const orderItems = input.items.map(lineToOrderItem);
  const demand = demandBySku(input.items);
  if (!input.skipStock) {
    await consumeWithoutReservation(db, demand);
  }
  const totals = totalsOf(orderItems, input.shipping.envioCop);
  const now = Date.now();
  const ref = db.collection(COLLECTIONS.orders).doc();
  const orderNumber = await nextOrderNumber(db);
  const order: MoraOrder = {
    id: ref.id,
    orderNumber,
    status: "paid",
    channel: input.channel ?? "manual",
    payment: {
      method: input.paymentMethod,
      status: "approved",
    },
    customer: input.customer,
    shipping: input.shipping,
    items: orderItems,
    totals,
    notes: input.notes,
    attribution: input.attribution,
    conversationId: input.conversationId,
    timeline: [
      { status: "awaiting_payment", at: now, by: input.createdBy },
      { status: "paid", at: now, by: input.createdBy, note: input.channel === "whatsapp" ? "Venta WhatsApp" : "Venta manual" },
    ],
    createdAt: now,
    updatedAt: now,
    paidAt: now,
    createdBy: input.createdBy,
  };
  await ref.set(order);
  await db
    .collection(COLLECTIONS.orderNumbers)
    .doc(orderNumber)
    .set({ orderId: ref.id, createdAt: now });
  await bumpDailyStats(order);
  await sendPaidCustomerEmail(order).catch(() => undefined);
  await sendPaidStaffEmail(order).catch(() => undefined);
  await recordPurchase(order);
  if (input.conversationId) {
    await updateConversation(input.conversationId, {
      status: "sold",
      orderId: order.id,
      orderNumber: order.orderNumber,
    }).catch(() => undefined);
  }
  await ref.set(
    { emails: { paidSentAt: Date.now() }, updatedAt: Date.now() },
    { merge: true },
  );
  return { ...order, emails: { paidSentAt: Date.now() } };
}

export async function getOrder(id: string) {
  const snap = await orderRef(adminDb(), id).get();
  if (!snap.exists) return null;
  return serializeOrder(snap.id, snap.data()!);
}

export async function getOrderByNumber(orderNumber: string) {
  const db = adminDb();
  const index = await db
    .collection(COLLECTIONS.orderNumbers)
    .doc(orderNumber.trim().toUpperCase())
    .get();
  if (index.exists) {
    const orderId = (index.data() as { orderId?: string }).orderId;
    if (orderId) return getOrder(orderId);
  }
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("orderNumber", "==", orderNumber.trim().toUpperCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  return serializeOrder(snap.docs[0].id, snap.docs[0].data());
}

export async function listOrders(limit = 80) {
  const snap = await adminDb()
    .collection(COLLECTIONS.orders)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => serializeOrder(doc.id, doc.data()));
}

export async function fulfillWompiPayment(input: {
  reference: string;
  transactionId: string;
  amountInCents: number;
  paymentType?: string;
  status: string;
}) {
  const db = adminDb();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("payment.wompiReference", "==", input.reference)
    .limit(1)
    .get();
  if (snap.empty) {
    const byId = await getOrder(input.reference.split("_")[0] ?? "");
    if (!byId) return null;
    return fulfillOrderDoc(byId, input);
  }
  const order = serializeOrder(snap.docs[0].id, snap.docs[0].data());
  return fulfillOrderDoc(order, input);
}

async function fulfillOrderDoc(
  order: MoraOrder,
  input: {
    transactionId: string;
    amountInCents: number;
    paymentType?: string;
    status: string;
  },
) {
  if (order.status === "cancelled") return order;
  if (order.status !== "awaiting_payment" && order.payment.status === "approved") {
    return order;
  }

  const wompiStatus = input.status.toUpperCase();
  const db = adminDb();
  const ref = orderRef(db, order.id);
  const now = Date.now();

  if (wompiStatus !== "APPROVED") {
    const paymentStatus: PaymentStatus =
      wompiStatus === "DECLINED"
        ? "declined"
        : wompiStatus === "VOIDED"
          ? "voided"
          : "error";
    if (["DECLINED", "VOIDED", "ERROR"].includes(wompiStatus)) {
      await ref.set(
        {
          payment: {
            ...order.payment,
            status: paymentStatus,
            wompiTransactionId: input.transactionId,
            wompiPaymentType: input.paymentType,
          },
          updatedAt: now,
        },
        { merge: true },
      );
    }
    return { ...order, payment: { ...order.payment, status: paymentStatus } };
  }

  const expectedCents = order.totals.total * 100;
  if (input.amountInCents !== expectedCents) {
    throw new Error("El monto de Wompi no coincide con el pedido.");
  }

  await consumeReservation(db, demandFromItems(order.items));
  const paid: MoraOrder = {
    ...order,
    status: "paid",
    payment: {
      method: "wompi",
      status: "approved",
      wompiTransactionId: input.transactionId,
      wompiReference: order.payment.wompiReference,
      wompiPaymentType: input.paymentType,
    },
    paidAt: now,
    updatedAt: now,
    timeline: [...order.timeline, { status: "paid", at: now, note: "Wompi" }],
  };
  await ref.set(paid);
  await bumpDailyStats(paid);
  await sendPaidCustomerEmail(paid).catch((error) =>
    console.error("[email paid customer]", error),
  );
  await sendPaidStaffEmail(paid).catch(() => undefined);
  await recordPurchase(paid);
  await ref.set(
    { emails: { ...(order.emails ?? {}), paidSentAt: Date.now() } },
    { merge: true },
  );
  return paid;
}

async function recordPurchase(order: MoraOrder) {
  const purchaseEventId = order.meta?.purchaseEventId ?? `purchase-${order.id}`;
  await orderRef(adminDb(), order.id).set(
    { meta: { purchaseEventId } },
    { merge: true },
  );
  await markLeadSold({
    phone: order.customer.phone,
    email: order.customer.email,
    orderId: order.id,
    orderNumber: order.orderNumber,
  }).catch(() => undefined);
  await sendMetaEvent({
    name: "Purchase",
    eventId: purchaseEventId,
    sourceUrl: undefined,
    actionSource: "website",
    user: {
      email: order.customer.email,
      phone: order.customer.phone,
      firstName: order.customer.firstName,
      lastName: order.customer.lastName,
      city: order.shipping.ciudad,
      state: order.shipping.departamento,
    },
    attribution: order.attribution,
    data: {
      currency: "COP",
      value: order.totals.total,
      order_id: order.orderNumber,
      content_ids: order.items.map((item) => item.sku),
      content_type: "product",
      num_items: order.items.reduce((sum, item) => sum + item.qty, 0),
    },
  }).catch(() => undefined);
}

export async function transitionOrder(input: {
  orderId: string;
  to: OrderStatus;
  by: string;
  trackingNumber?: string;
  note?: string;
}) {
  const db = adminDb();
  const ref = orderRef(db, input.orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Pedido no encontrado.");
  const order = serializeOrder(snap.id, snap.data()!);
  if (!canTransition(order.status, input.to)) {
    throw new Error("Ese cambio de estado no está permitido.");
  }

  const now = Date.now();
  const patch: Partial<MoraOrder> = {
    status: input.to,
    updatedAt: now,
    timeline: [
      ...order.timeline,
      {
        status: input.to,
        at: now,
        by: input.by,
        note: input.note,
      },
    ],
  };

  if (input.to === "in_transit") {
    patch.dispatchedAt = now;
    patch.shipping = {
      ...order.shipping,
      trackingNumber: input.trackingNumber?.trim() || order.shipping.trackingNumber,
    };
  }
  if (input.to === "delivered") patch.deliveredAt = now;
  if (input.to === "cancelled") {
    patch.cancelledAt = now;
    if (order.status === "awaiting_payment") {
      await releaseReservation(db, demandFromItems(order.items));
    }
  }
  if (input.to === "paid" && order.status === "awaiting_payment") {
    patch.paidAt = now;
    patch.payment = { ...order.payment, status: "approved" };
    await consumeReservation(db, demandFromItems(order.items));
  }

  await ref.set(patch, { merge: true });
  const next = { ...order, ...patch } as MoraOrder;

  if (input.to === "in_transit") {
    await sendDispatchedCustomerEmail(next).catch((error) =>
      console.error("[email dispatch]", error),
    );
    await ref.set(
      {
        emails: { ...(order.emails ?? {}), dispatchedSentAt: Date.now() },
      },
      { merge: true },
    );
  }

  return next;
}

export function publicOrderView(order: MoraOrder) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    items: order.items.map((item) => ({
      name: item.name,
      finishTitle: item.finishTitle,
      size: item.size,
      qty: item.qty,
    })),
    ciudad: order.shipping.ciudad,
    departamento: formatoDepartamentoEtiqueta(order.shipping.departamento),
    carrierLabel: order.shipping.carrierLabel,
    trackingNumber: order.shipping.trackingNumber ?? null,
    deliveryEstimate: order.shipping.deliveryEstimate ?? null,
    totals: { total: order.totals.total, shipping: order.totals.shipping },
    timeline: order.timeline,
    createdAt: order.createdAt,
    paidAt: order.paidAt ?? null,
    dispatchedAt: order.dispatchedAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    purchaseEventId: order.meta?.purchaseEventId ?? null,
  };
}

export type { OrderChannel };
