import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, DOCS, ORDER_SEQ_START, PENDING_TTL_MS } from "@/commerce/paths";
import { demandBySku, totalsOf } from "@/commerce/cartMath";
import { canTransition } from "@/commerce/orderMachine";
import { inventorySku, lineToOrderItem } from "@/commerce/sku";
import { orderHasSizer, orderNeedsSize } from "@/commerce/sizing";
import { legFromShipping } from "@/commerce/shipments";
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
import { isModelId, products, type FinishId } from "@/lib/catalog";
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
  sendCancelledCustomerEmail,
  sendDeliveredCustomerEmail,
  sendDispatchedCustomerEmail,
  sendSizerDispatchedEmail,
  sendPaidCustomerEmail,
  sendPaidStaffEmail,
} from "./email";
import { bumpDailyStats } from "./stats";
import { recordInsightsPurchase } from "./insights";
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
  paymentMethod?: Extract<PaymentMethod, "bold" | "addi">;
  boldReference?: string;
  addiReference?: string;
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
      method: input.paymentMethod ?? "bold",
      status: "pending",
      ...(input.boldReference ? { boldReference: input.boldReference } : {}),
      ...(input.addiReference ? { addiReference: input.addiReference } : {}),
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
  paymentMethod: Exclude<PaymentMethod, "bold" | "wompi" | "addi">;
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
  return fulfillOnlinePayment({ ...input, method: "bold" });
}

export async function fulfillAddiPayment(input: {
  reference: string;
  transactionId?: string;
  amountCop?: number;
  paymentType?: string;
  status: string;
  orderId?: string;
}) {
  return fulfillOnlinePayment({ ...input, method: "addi" });
}

async function fulfillOnlinePayment(input: {
  reference: string;
  transactionId?: string;
  amountCop?: number;
  paymentType?: string;
  status: string;
  orderId?: string;
  method: Extract<PaymentMethod, "bold" | "addi">;
}) {
  const db = adminDb();
  if (input.orderId) {
    const byMeta = await getOrder(input.orderId);
    if (byMeta) return fulfillOrderDoc(byMeta, { ...input, reference: input.reference });
  }
  const fields =
    input.method === "addi"
      ? (["payment.addiReference", "payment.boldReference"] as const)
      : (["payment.boldReference", "payment.wompiReference", "payment.addiReference"] as const);
  for (const field of fields) {
    const snap = await db
      .collection(COLLECTIONS.orders)
      .where(field, "==", input.reference)
      .limit(1)
      .get();
    if (!snap.empty) {
      return fulfillOrderDoc(serializeOrder(snap.docs[0].id, snap.docs[0].data()), {
        ...input,
        reference: input.reference,
      });
    }
  }
  return null;
}

export async function setOrderBoldReference(orderId: string, boldReference: string) {
  return setOrderPaymentReference(orderId, { method: "bold", reference: boldReference });
}

export async function setOrderPaymentReference(
  orderId: string,
  input: { method: Extract<PaymentMethod, "bold" | "addi">; reference: string },
) {
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
          method: input.method,
          status: "pending",
          ...(input.method === "addi"
            ? { addiReference: input.reference }
            : { boldReference: input.reference }),
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
    method?: Extract<PaymentMethod, "bold" | "addi">;
    reference?: string;
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
      throw new Error("El monto del pago no coincide con el pedido.");
    }

    const method = input.method ?? current.payment.method;
    const paid: MoraOrder = {
      ...current,
      status: "paid",
      payment: {
        ...current.payment,
        method: method === "addi" ? "addi" : "bold",
        status: "approved",
        boldTransactionId: method === "addi" ? current.payment.boldTransactionId : input.transactionId,
        boldReference: current.payment.boldReference ?? current.payment.wompiReference,
        boldPaymentType: method === "addi" ? current.payment.boldPaymentType : input.paymentType,
        addiApplicationId: method === "addi" ? input.transactionId : current.payment.addiApplicationId,
        addiReference:
          method === "addi"
            ? (current.payment.addiReference ?? input.reference)
            : current.payment.addiReference,
        addiStatus: method === "addi" ? input.status : current.payment.addiStatus,
      },
      paidAt: now,
      updatedAt: now,
      timeline: [
        ...current.timeline,
        { status: "paid", at: now, note: method === "addi" ? "Pago con Addi" : "Pago en línea" },
      ],
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
  await recordInsightsPurchase(order).catch(() => undefined);
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

  if (input.to === "sizer_transit") {
    if (!orderHasSizer(order.items)) {
      throw new Error("Este pedido no lleva medidor.");
    }
    const sizer = legFromShipping(order, "sizer", "in_transit");
    sizer.dispatchedAt = now;
    sizer.trackingNumber = input.trackingNumber?.trim() || sizer.trackingNumber;
    patch.shipments = { ...(order.shipments ?? {}), sizer };
  }
  if (input.to === "in_transit") {
    if (orderHasSizer(order.items)) {
      const sizerStatus = order.shipments?.sizer?.status;
      const sizerAlready =
        sizerStatus === "in_transit" ||
        sizerStatus === "delivered" ||
        order.status === "sizer_transit";
      if (!sizerAlready) {
        throw new Error("Primero marca el medidor en camino.");
      }
    }
    if (orderNeedsSize(order.items)) {
      throw new Error("Falta la talla. El cliente aún no la confirmó.");
    }
    const rings = legFromShipping(order, "rings", "in_transit");
    rings.dispatchedAt = now;
    rings.trackingNumber = input.trackingNumber?.trim() || rings.trackingNumber;
    patch.dispatchedAt = now;
    patch.shipments = { ...(order.shipments ?? {}), rings };
    patch.shipping = {
      ...order.shipping,
      trackingNumber: rings.trackingNumber || order.shipping.trackingNumber,
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
  const emails = { ...(order.emails ?? {}) };

  if (input.to === "paid" && !emails.paidSentAt) {
    await sendPaidCustomerEmail(next).catch((error) =>
      console.error("[email paid customer]", error),
    );
    emails.paidSentAt = Date.now();
  }

  if (input.to === "sizer_transit" && !emails.sizerDispatchedSentAt) {
    await sendSizerDispatchedEmail(next).catch((error) =>
      console.error("[email sizer]", error),
    );
    emails.sizerDispatchedSentAt = Date.now();
  }

  if (input.to === "in_transit" && !emails.dispatchedSentAt) {
    await sendDispatchedCustomerEmail(next).catch((error) =>
      console.error("[email dispatch]", error),
    );
    emails.dispatchedSentAt = Date.now();
  }

  if (input.to === "delivered" && !emails.deliveredSentAt) {
    await sendDeliveredCustomerEmail(next).catch((error) =>
      console.error("[email delivered]", error),
    );
    emails.deliveredSentAt = Date.now();
  }

  if (input.to === "cancelled" && !emails.cancelledSentAt) {
    await sendCancelledCustomerEmail(next).catch((error) =>
      console.error("[email cancelled]", error),
    );
    emails.cancelledSentAt = Date.now();
  }

  if (JSON.stringify(emails) !== JSON.stringify(order.emails ?? {})) {
    next.emails = emails;
    await ref.set({ emails }, { merge: true });
  }

  return next;
}

export async function attachShippingGuide(input: {
  orderId: string;
  by: string;
  shipping: Partial<MoraOrder["shipping"]>;
  note?: string;
  kind?: "sizer" | "rings";
}): Promise<MoraOrder> {
  const db = adminDb();
  const ref = orderRef(db, input.orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Pedido no encontrado.");
  const order = serializeOrder(snap.id, snap.data()!);
  const now = Date.now();
  const shipping = { ...order.shipping, ...input.shipping };
  const leg = input.kind
    ? {
        ...(order.shipments?.[input.kind] ?? { kind: input.kind, status: "pending" as const }),
        kind: input.kind,
        status: order.shipments?.[input.kind]?.status ?? ("pending" as const),
        trackingNumber: input.shipping.trackingNumber ?? order.shipments?.[input.kind]?.trackingNumber,
        hekaGuideId: input.shipping.hekaGuideId ?? order.shipments?.[input.kind]?.hekaGuideId,
        hekaStatus: input.shipping.hekaStatus ?? order.shipments?.[input.kind]?.hekaStatus,
        hekaStatusLabel: input.shipping.hekaStatusLabel ?? order.shipments?.[input.kind]?.hekaStatusLabel,
        carrier: input.shipping.carrier ?? order.shipments?.[input.kind]?.carrier,
        carrierLabel: input.shipping.carrierLabel ?? order.shipments?.[input.kind]?.carrierLabel,
      }
    : null;
  const shipments = leg ? { ...(order.shipments ?? {}), [input.kind!]: leg } : order.shipments;
  const timeline = input.note
    ? [...order.timeline, { status: order.status, at: now, by: input.by, note: input.note }]
    : order.timeline;
  await ref.set(
    { shipping, ...(shipments ? { shipments } : {}), timeline, updatedAt: now },
    { merge: true },
  );
  return { ...order, shipping, shipments, timeline, updatedAt: now };
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
    if (item.kind === "case" || item.modelId === "case") return item;
    const product = isModelId(item.modelId) ? products[item.modelId] : undefined;
    if (!product?.sizes.includes(pick.size)) {
      throw new Error("Hay una talla inválida.");
    }
    if ((item.sizing ?? "self") !== "kit" && item.size && item.size !== pick.size) {
      throw new Error("Esa talla ya estaba elegida.");
    }
    const nextSku = inventorySku(item.modelId as "aero" | "titan", item.finishId as FinishId, pick.size);
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
  } else if (order.status === "paid" || order.status === "sizer_transit") {
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
    hasSizer: orderHasSizer(order.items),
    sizerTrackingNumber: order.shipments?.sizer?.trackingNumber ?? null,
    sizerStatus: order.shipments?.sizer?.status ?? null,
    items: order.items.map((item) => ({
      kind: item.kind,
      modelId: item.modelId,
      finishId: item.finishId,
      name: item.name,
      finishTitle: item.finishTitle,
      size: item.size,
      sizing: item.sizing ?? "self",
      qty: item.qty,
      unitPrice: item.unitPrice,
      sizes: isModelId(item.modelId) ? products[item.modelId].sizes : [],
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
