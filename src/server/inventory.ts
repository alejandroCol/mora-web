import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { catalog } from "@/lib/catalog";
import { COLLECTIONS } from "@/commerce/paths";
import { availableUnits, inventorySku } from "@/commerce/sku";
import type { InventoryDoc } from "@/commerce/types";
import { adminDb } from "@/lib/firebaseAdmin";

export function inventoryRef(db: Firestore, sku: string) {
  return db.collection(COLLECTIONS.inventory).doc(sku);
}

export async function listInventory(): Promise<InventoryDoc[]> {
  const db = adminDb();
  await seedInventoryIfNeeded(db);
  const snap = await db.collection(COLLECTIONS.inventory).get();
  return snap.docs.map((doc) => doc.data() as InventoryDoc);
}

async function seedInventoryIfNeeded(db: Firestore) {
  const existing = await db.collection(COLLECTIONS.inventory).get();
  const have = new Set(existing.docs.map((doc) => doc.id));
  const now = Date.now();
  const batch = db.batch();
  let writes = 0;
  for (const product of catalog) {
    for (const finishId of product.finishes) {
      const sku = inventorySku(product.id, finishId);
      if (have.has(sku)) continue;
      const data: InventoryDoc = {
        sku,
        modelId: product.id,
        finishId,
        units: 0,
        reserved: 0,
        updatedAt: now,
      };
      batch.set(inventoryRef(db, sku), data);
      writes += 1;
    }
  }
  if (writes > 0) await batch.commit();
}

export async function setInventoryUnits(sku: string, units: number) {
  const db = adminDb();
  const ref = inventoryRef(db, sku);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.data() as InventoryDoc | undefined) ?? {
      sku,
      units: 0,
      reserved: 0,
    };
    const nextUnits = Math.max(0, Math.round(units));
    if (nextUnits < (current.reserved ?? 0)) {
      throw new Error(
        "No puedes dejar menos unidades que las ya reservadas en checkouts abiertos.",
      );
    }
    tx.set(
      ref,
      {
        ...(snap.data() ?? {}),
        sku,
        units: nextUnits,
        reserved: current.reserved ?? 0,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  });
}

export async function assertAndReserve(
  db: Firestore,
  demand: Map<string, number>,
) {
  const refs = [...demand.keys()].map((sku) => inventoryRef(db, sku));
  await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    snaps.forEach((snap, index) => {
      const sku = refs[index].id;
      const qty = demand.get(sku) ?? 0;
      const data = snap.data() as InventoryDoc | undefined;
      const available = availableUnits(data?.units ?? 0, data?.reserved ?? 0);
      if (available < qty) {
        throw new Error(`Sin stock suficiente para ${sku}.`);
      }
    });
    snaps.forEach((snap, index) => {
      const sku = refs[index].id;
      const qty = demand.get(sku) ?? 0;
      tx.set(
        refs[index],
        {
          ...(snap.data() ?? { sku, units: 0 }),
          reserved: FieldValue.increment(qty),
          updatedAt: Date.now(),
        },
        { merge: true },
      );
    });
  });
}

export async function consumeReservation(
  db: Firestore,
  demand: Map<string, number>,
) {
  const refs = [...demand.keys()].map((sku) => inventoryRef(db, sku));
  await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    snaps.forEach((snap, index) => {
      const sku = refs[index].id;
      const qty = demand.get(sku) ?? 0;
      const data = snap.data() as InventoryDoc | undefined;
      const units = Math.max(0, (data?.units ?? 0) - qty);
      const reserved = Math.max(0, (data?.reserved ?? 0) - qty);
      tx.set(
        refs[index],
        {
          ...(snap.data() ?? { sku }),
          units,
          reserved,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
    });
  });
}

export async function releaseReservation(
  db: Firestore,
  demand: Map<string, number>,
) {
  const refs = [...demand.keys()].map((sku) => inventoryRef(db, sku));
  const batch = db.batch();
  for (const ref of refs) {
    const qty = demand.get(ref.id) ?? 0;
    batch.set(
      ref,
      {
        reserved: FieldValue.increment(-qty),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  }
  await batch.commit();
}

export async function consumeWithoutReservation(
  db: Firestore,
  demand: Map<string, number>,
) {
  const refs = [...demand.keys()].map((sku) => inventoryRef(db, sku));
  await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    snaps.forEach((snap, index) => {
      const sku = refs[index].id;
      const qty = demand.get(sku) ?? 0;
      const data = snap.data() as InventoryDoc | undefined;
      const available = availableUnits(data?.units ?? 0, data?.reserved ?? 0);
      if (available < qty) {
        throw new Error(`Sin stock suficiente para ${sku}.`);
      }
      tx.set(
        refs[index],
        {
          ...(snap.data() ?? { sku, reserved: 0 }),
          units: (data?.units ?? 0) - qty,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
    });
  });
}

export function demandFromItems(
  items: { sku: string; qty: number }[],
) {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.sku, (map.get(item.sku) ?? 0) + item.qty);
  }
  return map;
}
