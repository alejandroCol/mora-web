import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, DOCS, ORDER_SEQ_START, PENDING_TTL_MS } from "@/commerce/paths";
import { demandBySku, totalsOf } from "@/commerce/cartMath";
import { canTransition } from "@/commerce/orderMachine";
import { inventorySku, lineToOrderItem } from "@/commerce/sku";
import { orderNeedsSize } from "@/commerce/sizing";
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
import { products } from "@/lib/catalog";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  consumeReservation,
  consumeWithoutReservation,
  demandFromItems,
  releaseReservation,
  restoreUnits,
  assertAndReserve,
} from "./inventory";
import {
  sendDispatchedCustomerEmail,
  sendPaidCustomerEmail,
  sendPaidStaffEmail,
} from "./email";
import { bumpDailyStats } from "./stats";
import { formatoDepartamentoEtiqueta } from "@/lib/colombiaGeo";
import { tryEmitPaidOrderInvoice } from "@/invoices";
import { markCartRecovered } from "./abandonedCarts";
import { markLeadSold } from "./leads";
import { sendMetaEvent } from "./metaCapi";
import { updateConversation } from "./whatsapp";

function orderRef(db: Firestore, id: string) {
  return db.collection(COLLECTIONS.orders).doc(id);
}

export function serializeOrder(id: string, data: DocumentData): MoraOrder {
  const order = { id, ...(data as Omit<MoraOrder, "id">) };
  const totals = order.totals ?? { subtotal: 0, shipping: 0, total: 0 };
  order.totals = {
    subtotal: totals.subtotal ?? 0,
    shipping: totals.shipping ?? 0,
    discount: totals.discount ?? 0,
    total: totals.total ?? 0,
  };
  return order;
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
  boldReference: string;
  attribution?: AttributionSnapshot;
  discountCop?: number;
  cartSessionId?: string;
  offerCode?: string;
}): Promise<MoraOrder> {
  await releaseExpiredCheckouts();
  const db = adminDb();
  const orderItems = input.items.map(lineToOrderItem);
  const demand = demandBySku(input.items);
  await assertAndReserve(db, demand);

  const totals = totalsOf(
    orderItems,
    input.shipping.envioCop,
    input.discountCop ?? 0,
  );
  const now = Date.now();
  const ref = db.collection(COLLECTIONS.orders).doc();
  const orderNumber = await nextOrderNumber(db);
  const order: MoraOrder = {
    id: ref.id,
    orderNumber,
    status: "awaiting_payment",
    channel: "online",
    payment: {
      method: "bold",
      status: "pending",
      boldReference: input.boldReference,
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
  if (input.cartSessionId || input.offerCode) {
    order.meta = {
      ...(input.cartSessionId ? { cartSessionId: input.cartSessionId } : {}),
      ...(input.offerCode ? { offerCode: input.offerCode } : {}),
    };
  }

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
  paymentMethod: Exclude<PaymentMethod, "bold" | "wompi">;
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
    const { addCrmNote } = await import("./crm");
    await addCrmNote({
      phone: input.conversationId,
      text: `Venta ${order.orderNumber}`,
      by: input.createdBy,
      byName: "Ventas",
      kind: "system",
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

export async function listOrdersByPhone(phone: string, limit = 200) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return [];
  const orders = await listOrders(limit);
  return orders.filter((order) => {
    const other = (order.customer.phone ?? "").replace(/\D/g, "");
    if (!other) return false;
    return other === digits || other.endsWith(digits.slice(-10)) || digits.endsWith(other.slice(-10));
  });
}

export async function fulfillBoldPayment(input: {
  reference: string;
  transactionId?: string;
  amountCop?: number;
  paymentType?: string;
  status: string;
  orderId?: string;
}) {
  const db = adminDb();
  if (input.orderId) {
    const byMeta = await getOrder(input.orderId);
    if (byMeta) return fulfillOrderDoc(byMeta, input);
  }
  for (const field of ["payment.boldReference", "payment.wompiReference"] as const) {
    const snap = await db
      .collection(COLLECTIONS.orders)
      .where(field, "==", input.reference)
      .limit(1)
      .get();
    if (!snap.empty) {
      return fulfillOrderDoc(serializeOrder(snap.docs[0].id, snap.docs[0].data()), input);
    }
  }
  return null;
}

export async function setOrderBoldReference(orderId: string, boldReference: string) {
  const db = adminDb();
  const ref = orderRef(db, orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Pedido no encontrado.");
    const order = serializeOrder(snap.id, snap.data()!);
    if (order.status !== "awaiting_payment") {
      throw new Error("Ese pedido ya no espera pago.");
    }
    if (order.payment.status === "approved") {
      throw new Error("Ese pedido ya está pagado.");
    }
    tx.set(
      ref,
      {
        payment: {
          ...order.payment,
          method: "bold",
          status: "pending",
          boldReference,
        },
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  });
}

async function fulfillOrderDoc(
  order: MoraOrder,
  input: {
    transactionId?: string;
    amountCop?: number;
    paymentType?: string;
    status: string;
  },
) {
  const status = input.status.toUpperCase();
  const db = adminDb();
  const ref = orderRef(db, order.id);

  const outcome = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) return { kind: "missing" as const, order };
    const current = serializeOrder(fresh.id, fresh.data()!);
    if (current.status === "cancelled") {
      return { kind: "cancelled" as const, order: current };
    }
    if (current.status === "paid" || current.payment.status === "approved") {
      return { kind: "duplicate" as const, order: current };
    }
    if (current.status !== "awaiting_payment") {
      return { kind: "skip" as const, order: current };
    }

    const now = Date.now();
    if (status !== "APPROVED") {
      const paymentStatus: PaymentStatus =
        status === "REJECTED" || status === "DECLINED"
          ? "declined"
          : status === "VOIDED"
            ? "voided"
            : status === "FAILED" || status === "ERROR"
              ? "error"
              : "pending";
      const next: MoraOrder = {
        ...current,
        payment: {
          ...current.payment,
          status: paymentStatus,
          boldTransactionId: input.transactionId,
          boldPaymentType: input.paymentType,
        },
        updatedAt: now,
      };
      tx.set(
        ref,
        {
          payment: next.payment,
          updatedAt: now,
        },
        { merge: true },
      );
      return { kind: "recorded" as const, order: next };
    }

    if (input.amountCop != null && input.amountCop !== current.totals.total) {
      throw new Error("El monto de Bold no coincide con el pedido.");
    }

    const paid: MoraOrder = {
      ...current,
      status: "paid",
      payment: {
        method: "bold",
        status: "approved",
        boldTransactionId: input.transactionId,
        boldReference: current.payment.boldReference ?? current.payment.wompiReference,
        boldPaymentType: input.paymentType,
      },
      paidAt: now,
      updatedAt: now,
      timeline: [...current.timeline, { status: "paid", at: now, note: "Pago en línea" }],
    };
    tx.set(ref, paid);
    return { kind: "applied" as const, order: paid };
  });

  if (outcome.kind !== "applied" && outcome.kind !== "duplicate") {
    return outcome.order;
  }

  const paid = outcome.order;
  if (outcome.kind === "applied") {
    await consumeReservation(db, demandFromItems(paid.items));
    await bumpDailyStats(paid);
    await sendPaidCustomerEmail(paid).catch((error) =>
      console.error("[email paid customer]", error),
    );
    await sendPaidStaffEmail(paid).catch(() => undefined);
    await recordPurchase(paid);
    await ref.set(
      { emails: { ...(paid.emails ?? {}), paidSentAt: Date.now() } },
      { merge: true },
    );
  }

  if (paid.status === "paid" && paid.payment.status === "approved") {
    await tryEmitPaidOrderInvoice(db, paid).catch((error) =>
      console.error("[matias]", error),
    );
  }
  return paid;
}

async function recordPurchase(order: MoraOrder) {
  const purchaseEventId = order.meta?.purchaseEventId ?? `purchase-${order.id}`;
  await orderRef(adminDb(), order.id).set(
    { meta: { ...(order.meta ?? {}), purchaseEventId } },
    { merge: true },
  );
  await markCartRecovered({
    sessionId: order.meta?.cartSessionId,
    offerCode: order.meta?.offerCode,
    email: order.customer.email,
    orderId: order.id,
    orderNumber: order.orderNumber,
  }).catch(() => undefined);
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
    if (orderNeedsSize(order.items)) {
      throw new Error("Falta la talla. El cliente aún no la confirmó.");
    }
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

export async function confirmOrderSizes(input: {
  orderNumber: string;
  sizes: { index: number; size: number }[];
}): Promise<MoraOrder> {
  const order = await getOrderByNumber(input.orderNumber);
  if (!order) throw new Error("No encontramos ese pedido.");
  if (
    order.status === "cancelled" ||
    order.status === "in_transit" ||
    order.status === "delivered"
  ) {
    throw new Error("Ya no se puede cambiar la talla.");
  }

  const now = Date.now();
  const take = new Map<string, number>();
  const back = new Map<string, number>();
  const items = order.items.map((item, index) => {
    const pick = input.sizes.find((entry) => entry.index === index);
    if (!pick) return item;
    const product = products[item.modelId];
    if (!product?.sizes.includes(pick.size)) {
      throw new Error("Hay una talla inválida.");
    }
    if ((item.sizing ?? "self") !== "kit" && item.size && item.size !== pick.size) {
      throw new Error("Esa talla ya estaba elegida.");
    }
    const nextSku = inventorySku(item.modelId, item.finishId, pick.size);
    if (item.sku !== nextSku) {
      const qty = Math.max(1, Math.round(item.qty));
      take.set(nextSku, (take.get(nextSku) ?? 0) + qty);
      if (item.sku) back.set(item.sku, (back.get(item.sku) ?? 0) + qty);
    }
    return { ...item, size: pick.size, sku: nextSku, sizedAt: now };
  });

  if (!items.some((item, index) => item.size !== order.items[index].size)) {
    throw new Error("Elige una talla.");
  }

  const db = adminDb();
  if (order.status === "awaiting_payment") {
    if (take.size) await assertAndReserve(db, take);
    if (back.size) await releaseReservation(db, back);
  } else if (order.status === "paid") {
    if (take.size) await consumeWithoutReservation(db, take);
    if (back.size) await restoreUnits(db, back);
  }

  const ref = orderRef(db, order.id);
  await ref.set({ items, updatedAt: now }, { merge: true });
  return { ...order, items, updatedAt: now };
}

export function publicOrderView(order: MoraOrder) {
  const expired = Boolean(order.expiresAt && order.expiresAt <= Date.now());
  const canRetry =
    order.status === "awaiting_payment" &&
    !expired &&
    (order.payment.status === "declined" ||
      order.payment.status === "voided" ||
      order.payment.status === "error");
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.payment.status,
    canRetry,
    expiresAt: order.expiresAt ?? null,
    needsSize: orderNeedsSize(order.items),
    items: order.items.map((item) => ({
      name: item.name,
      finishTitle: item.finishTitle,
      size: item.size,
      sizing: item.sizing ?? "self",
      qty: item.qty,
      sizes: products[item.modelId]?.sizes ?? [],
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
