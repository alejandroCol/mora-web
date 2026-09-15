import { COLLECTIONS } from "@/commerce/paths";
import type { DailyStats, MoraOrder, PaymentMethod } from "@/commerce/types";
import { PAYMENT_METHODS } from "@/commerce/types";
import { adminDb } from "@/lib/firebaseAdmin";

function emptyMethods(): DailyStats["byMethod"] {
  return {
    wompi: { count: 0, revenue: 0 },
    transferencia: { count: 0, revenue: 0 },
    efectivo: { count: 0, revenue: 0 },
    datafono: { count: 0, revenue: 0 },
  };
}

function dayKey(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function bumpDailyStats(order: MoraOrder) {
  const date = dayKey(order.paidAt ?? order.createdAt);
  const ref = adminDb().collection(COLLECTIONS.statsDaily).doc(date);
  const method: PaymentMethod = order.payment.method;
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.data() as DailyStats | undefined) ?? {
      date,
      ordersCount: 0,
      revenue: 0,
      cancelledCount: 0,
      byMethod: emptyMethods(),
    };
    const next: DailyStats = {
      ...current,
      byMethod: { ...emptyMethods(), ...current.byMethod },
      ordersCount: current.ordersCount + 1,
      revenue: current.revenue + order.totals.total,
    };
    next.byMethod[method] = {
      count: (next.byMethod[method]?.count ?? 0) + 1,
      revenue: (next.byMethod[method]?.revenue ?? 0) + order.totals.total,
    };
    tx.set(ref, next);
  });
}

export async function loadStats(days = 30) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const snap = await adminDb()
    .collection(COLLECTIONS.statsDaily)
    .where("date", ">=", dayKey(since))
    .orderBy("date", "asc")
    .get();

  const series = snap.docs.map((doc) => doc.data() as DailyStats);
  const byMethod = emptyMethods();
  let ordersCount = 0;
  let revenue = 0;
  for (const day of series) {
    ordersCount += day.ordersCount;
    revenue += day.revenue;
    for (const method of PAYMENT_METHODS) {
      byMethod[method].count += day.byMethod?.[method]?.count ?? 0;
      byMethod[method].revenue += day.byMethod?.[method]?.revenue ?? 0;
    }
  }

  const recent = await adminDb()
    .collection("orders")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();
  const live = recent.docs.map((doc) => doc.data() as MoraOrder);
  const cancelledCount = live.filter(
    (order) =>
      order.status === "cancelled" && order.createdAt >= since,
  ).length;
  const awaiting = live.filter((order) => order.status === "awaiting_payment").length;
  const inTransit = live.filter((order) => order.status === "in_transit").length;

  return {
    days,
    ordersCount,
    revenue,
    cancelledCount,
    awaiting,
    inTransit,
    ticket: ordersCount > 0 ? Math.round(revenue / ordersCount) : 0,
    byMethod,
    series,
  };
}
