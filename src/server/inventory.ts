import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { CASE_PRODUCT } from "@/lib/cases";
import { catalog } from "@/lib/catalog";
import { COLLECTIONS } from "@/commerce/paths";
import {
  availableUnits,
  caseSku,
  inventoryLabel,
  inventorySku,
  parseInventorySku,
} from "@/commerce/sku";
import type { InventoryDoc } from "@/commerce/types";
import { adminDb } from "@/lib/firebaseAdmin";

const DEFAULT_UNITS = 50;
const DEFAULT_CASE_UNITS = 50;

export function inventoryRef(db: Firestore, sku: string) {
  return db.collection(COLLECTIONS.inventory).doc(sku);
}

export async function listInventory(): Promise<InventoryDoc[]> {
  const db = adminDb();
  await seedInventoryIfNeeded(db);
  const snap = await db.collection(COLLECTIONS.inventory).get();
  return snap.docs.map((doc) => doc.data() as InventoryDoc);
}

export async function seedInventoryIfNeeded(db: Firestore) {
  const existing = await db.collection(COLLECTIONS.inventory).get();
  const have = new Map(existing.docs.map((doc) => [doc.id, doc.data() as InventoryDoc]));
  const now = Date.now();
  const batch = db.batch();
  let writes = 0;
  for (const product of catalog) {
    for (const finishId of product.finishes) {
      const legacy = have.get(`${product.id}__${finishId}`);
      const inherited =
        legacy && (legacy.managed || legacy.units > 0) ? legacy.units : DEFAULT_UNITS;
      for (const size of product.sizes) {
        const sku = inventorySku(product.id, finishId, size);
        const current = have.get(sku);
        if (current?.managed) continue;
        if (current && (current.units > 0 || (current.reserved ?? 0) > 0)) continue;
        const data: InventoryDoc = {
          sku,
          modelId: product.id,
          finishId,
          size,
          units: inherited,
          reserved: current?.reserved ?? 0,
          updatedAt: now,
          managed: false,
        };
        batch.set(inventoryRef(db, sku), data, { merge: true });
        writes += 1;
      }
    }
  }
  for (const colorId of CASE_PRODUCT.colors) {
    const sku = caseSku(colorId);
    const current = have.get(sku);
    if (current?.managed) continue;
    if (current && (current.units > 0 || (current.reserved ?? 0) > 0)) continue;
    const data: InventoryDoc = {
      sku,
      modelId: "case",
      finishId: colorId,
      units: DEFAULT_CASE_UNITS,
      reserved: current?.reserved ?? 0,
      updatedAt: now,
      managed: false,
    };
    batch.set(inventoryRef(db, sku), data, { merge: true });
    writes += 1;
  }
  if (writes > 0) await batch.commit();
}

export async function setInventoryUnits(sku: string, units: number) {
  const parsed = parseInventorySku(sku);
  if (!parsed || (parsed.modelId !== "case" && !parsed.size)) {
    throw new Error("Esa referencia no existe.");
  }
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
        modelId: parsed.modelId,
        finishId: parsed.finishId,
        ...(parsed.size ? { size: parsed.size } : {}),
        units: nextUnits,
        reserved: current.reserved ?? 0,
        updatedAt: Date.now(),
        managed: true,
      },
      { merge: true },
    );
  });
}

export async function assertAndReserve(
  db: Firestore,
  demand: Map<string, number>,
) {
  await seedInventoryIfNeeded(db);
  const refs = [...demand.keys()].map((sku) => inventoryRef(db, sku));
  await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    snaps.forEach((snap, index) => {
      const sku = refs[index].id;
      const qty = demand.get(sku) ?? 0;
      const data = snap.data() as InventoryDoc | undefined;
      const available = availableUnits(data?.units ?? 0, data?.reserved ?? 0);
      if (available < qty) {
        throw new Error(`Sin stock suficiente para ${inventoryLabel(sku)}.`);
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

/** Mira que haya stock libre sin apartarlo. */
export async function assertAvailable(db: Firestore, demand: Map<string, number>) {
  await seedInventoryIfNeeded(db);
  const snaps = await Promise.all([...demand.keys()].map((sku) => inventoryRef(db, sku).get()));
  snaps.forEach((snap) => {
    const data = snap.data() as InventoryDoc | undefined;
    if (availableUnits(data?.units ?? 0, data?.reserved ?? 0) < (demand.get(snap.id) ?? 0)) {
      throw new Error(`Sin stock suficiente para ${inventoryLabel(snap.id)}.`);
    }
  });
}

/**
 * Aparta dentro de una transacción del llamador. Lee el inventario, así que va antes de
 * cualquier escritura de esa transacción.
 */
export async function reserveInTransaction(
  tx: Transaction,
  db: Firestore,
  demand: Map<string, number>,
) {
  const refs = [...demand.keys()].map((sku) => inventoryRef(db, sku));
  const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
  snaps.forEach((snap, index) => {
    const data = snap.data() as InventoryDoc | undefined;
    if (availableUnits(data?.units ?? 0, data?.reserved ?? 0) < (demand.get(refs[index].id) ?? 0)) {
      throw new Error(`Sin stock suficiente para ${inventoryLabel(refs[index].id)}.`);
    }
  });
  return () => {
    for (const ref of refs) {
      tx.set(
        ref,
        { reserved: FieldValue.increment(demand.get(ref.id) ?? 0), updatedAt: Date.now() },
        { merge: true },
      );
    }
  };
}

/**
 * Descuenta lo vendido dentro de una transacción del llamador (lee, así que va antes de
 * escribir). Con apartado, sale de lo apartado. Sin apartado, sale de lo libre; si no alcanza,
 * no toca el stock y devuelve `short`.
 */
export async function consumeInTransaction(
  tx: Transaction,
  db: Firestore,
  demand: Map<string, number>,
  held: boolean,
) {
  const refs = [...demand.keys()].map((sku) => inventoryRef(db, sku));
  const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
  const rows = snaps.map((snap, index) => {
    const data = snap.data() as InventoryDoc | undefined;
    return {
      ref: refs[index],
      qty: demand.get(refs[index].id) ?? 0,
      units: data?.units ?? 0,
      reserved: data?.reserved ?? 0,
    };
  });
  const short =
    !held && rows.some((row) => availableUnits(row.units, row.reserved) < row.qty);
  return {
    short,
    apply() {
      if (short) return;
      for (const row of rows) {
        tx.set(
          row.ref,
          {
            units: Math.max(0, row.units - row.qty),
            ...(held ? { reserved: Math.max(0, row.reserved - row.qty) } : {}),
            updatedAt: Date.now(),
          },
          { merge: true },
        );
      }
    },
  };
}

/** Libera dentro de una transacción del llamador. Solo escribe. */
export function releaseInTransaction(tx: Transaction, db: Firestore, demand: Map<string, number>) {
  for (const [sku, qty] of demand) {
    tx.set(
      inventoryRef(db, sku),
      { reserved: FieldValue.increment(-qty), updatedAt: Date.now() },
      { merge: true },
    );
  }
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
  await seedInventoryIfNeeded(db);
  const refs = [...demand.keys()].map((sku) => inventoryRef(db, sku));
  await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    snaps.forEach((snap, index) => {
      const sku = refs[index].id;
      const qty = demand.get(sku) ?? 0;
      const data = snap.data() as InventoryDoc | undefined;
      const available = availableUnits(data?.units ?? 0, data?.reserved ?? 0);
      if (available < qty) {
        throw new Error(`Sin stock suficiente para ${inventoryLabel(sku)}.`);
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

export async function restoreUnits(db: Firestore, demand: Map<string, number>) {
  if (demand.size === 0) return;
  const batch = db.batch();
  for (const [sku, qty] of demand) {
    if (!sku || qty <= 0) continue;
    batch.set(
      inventoryRef(db, sku),
      {
        units: FieldValue.increment(qty),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  }
  await batch.commit();
}

export function demandFromItems(
  items: { sku: string; qty: number }[],
) {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item.sku) continue;
    map.set(item.sku, (map.get(item.sku) ?? 0) + item.qty);
  }
  return map;
}
