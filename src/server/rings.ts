import { COLLECTIONS, DOCS } from "@/commerce/paths";
import {
  buildRingsSnapshot,
  normalizeRingsConfig,
  RING_SOLD_STATUSES,
  type RingsEconomicsConfig,
  type RingsEconomicsSnapshot,
} from "@/commerce/rings";
import type { MoraOrder, OrderStatus } from "@/commerce/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { listExpenses, listOrders as listPurchaseOrders } from "@/server/finance";
import { serializeOrder } from "@/server/orders";

function ringsDoc() {
  return adminDb().doc(DOCS.rings);
}

export async function loadRingsConfig(): Promise<RingsEconomicsConfig> {
  const snap = await ringsDoc().get();
  return normalizeRingsConfig(snap.exists ? (snap.data() as Partial<RingsEconomicsConfig>) : undefined);
}

export async function saveRingsConfig(
  patch: Partial<RingsEconomicsConfig>,
): Promise<RingsEconomicsConfig> {
  const current = await loadRingsConfig();
  const next = normalizeRingsConfig({
    ...current,
    ...(patch.ivaMode ? { ivaMode: patch.ivaMode } : {}),
    ...(patch.paymentFees ? { paymentFees: patch.paymentFees } : {}),
    ...(patch.models ? { models: patch.models } : {}),
    updatedAt: Date.now(),
  });
  await ringsDoc().set(next);
  return next;
}

async function listSoldOrders(): Promise<MoraOrder[]> {
  const snaps = await Promise.all(
    RING_SOLD_STATUSES.map((status) =>
      adminDb().collection(COLLECTIONS.orders).where("status", "==", status as OrderStatus).get(),
    ),
  );
  const seen = new Set<string>();
  const orders: MoraOrder[] = [];
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      orders.push(serializeOrder(doc.id, doc.data()));
    }
  }
  return orders;
}

export async function ringsSnapshot(month?: string): Promise<RingsEconomicsSnapshot> {
  const [config, expenses, purchaseOrders, orders] = await Promise.all([
    loadRingsConfig(),
    listExpenses(),
    listPurchaseOrders(),
    listSoldOrders(),
  ]);
  return buildRingsSnapshot({
    month,
    config,
    expenses,
    purchaseOrders,
    orders,
  });
}

export async function updateRingsSnapshot(
  patch: Partial<RingsEconomicsConfig>,
  month?: string,
): Promise<RingsEconomicsSnapshot> {
  const config = await saveRingsConfig(patch);
  const [expenses, purchaseOrders, orders] = await Promise.all([
    listExpenses(),
    listPurchaseOrders(),
    listSoldOrders(),
  ]);
  return buildRingsSnapshot({
    month,
    config,
    expenses,
    purchaseOrders,
    orders,
  });
}
