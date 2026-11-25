import { FieldValue } from "firebase-admin/firestore";
import { DOCS, COLLECTIONS } from "@/commerce/paths";
import { parseScarcityCount, sizeBadge, sizeIsOut, SCARCITY_MAX, type ScarcityNote } from "@/commerce/scarcity";
import { availableUnits, inventorySku, parseInventorySku } from "@/commerce/sku";
import type { InventoryDoc } from "@/commerce/types";
import { isCaseColorId, type CaseColorId } from "@/lib/cases";
import { products, type ModelId } from "@/lib/catalog";
import { adminDb } from "@/lib/firebaseAdmin";

export type ScarcityNotes = Record<string, ScarcityNote>;

function cleanNote(value: unknown): ScarcityNote | null {
  if (typeof value === "number") {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1 || count > SCARCITY_MAX) return null;
    return { on: false, count };
  }
  if (!value || typeof value !== "object") return null;
  const raw = value as { on?: unknown; count?: unknown };
  const count = Number(raw.count);
  if (!Number.isInteger(count) || count < 1 || count > SCARCITY_MAX) return null;
  return { on: raw.on === true, count };
}

function cleanNotes(raw: unknown): ScarcityNotes {
  if (!raw || typeof raw !== "object") return {};
  const notes: ScarcityNotes = {};
  for (const [sku, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseInventorySku(sku);
    if (!parsed || parsed.modelId === "case" || !parsed.size) continue;
    const note = cleanNote(value);
    if (note) notes[sku] = note;
  }
  return notes;
}

export async function readScarcity(): Promise<ScarcityNotes> {
  try {
    const snap = await adminDb().doc(DOCS.scarcity).get();
    const data = snap.data();
    return cleanNotes(data?.notes ?? data?.counts);
  } catch (error) {
    console.error("[scarcity]", error);
    return {};
  }
}

export async function setScarcity(sku: string, note: ScarcityNote | null) {
  const parsed = parseInventorySku(sku);
  if (!parsed || parsed.modelId === "case" || !parsed.size) {
    throw Object.assign(new Error("Elige un anillo, un color y una talla."), { status: 400 });
  }
  const ref = adminDb().doc(DOCS.scarcity);
  if (note == null) {
    await ref.set(
      {
        [`notes.${sku}`]: FieldValue.delete(),
        [`counts.${sku}`]: FieldValue.delete(),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    return;
  }
  await ref.set(
    {
      notes: { [sku]: { on: note.on, count: note.count } },
      [`counts.${sku}`]: FieldValue.delete(),
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export type SizeShelf = {
  /** `color:talla` → el aviso, solo si está prendido y hay unidades. */
  left: Record<string, number>;
  /** `color:talla` sin unidades. */
  out: string[];
};

/** Lo que pinta la ficha. Nunca van las unidades. */
export async function sizeShelf(modelId: ModelId): Promise<SizeShelf> {
  const product = products[modelId];
  const empty = { left: {}, out: [] };
  try {
    const db = adminDb();
    const [notes, snap] = await Promise.all([
      readScarcity(),
      db.collection(COLLECTIONS.inventory).get(),
    ]);
    const stock = new Map<string, InventoryDoc>();
    for (const doc of snap.docs) {
      if (!doc.id.startsWith(`${modelId}__`)) continue;
      stock.set(doc.id, doc.data() as InventoryDoc);
    }
    const left: Record<string, number> = {};
    const out: string[] = [];
    for (const finishId of product.finishes) {
      for (const size of product.sizes) {
        const sku = inventorySku(modelId, finishId, size);
        const row = stock.get(sku);
        const available = row ? availableUnits(row.units ?? 0, row.reserved ?? 0) : null;
        const key = `${finishId}:${size}`;
        if (sizeIsOut(available)) out.push(key);
        const badge = sizeBadge(available, notes[sku] ?? null);
        if (badge) left[key] = badge;
      }
    }
    return { left, out };
  } catch (error) {
    console.error("[scarcity badges]", error);
    return empty;
  }
}

/** Colores del case sin unidades libres: la tienda no los ofrece. */
export async function caseColorsOut(): Promise<CaseColorId[]> {
  try {
    const snap = await adminDb()
      .collection(COLLECTIONS.inventory)
      .where("modelId", "==", "case")
      .get();
    const out: CaseColorId[] = [];
    for (const doc of snap.docs) {
      const row = doc.data() as InventoryDoc;
      if (!isCaseColorId(row.finishId)) continue;
      if (sizeIsOut(availableUnits(row.units ?? 0, row.reserved ?? 0))) out.push(row.finishId);
    }
    return out;
  } catch (error) {
    console.error("[case stock]", error);
    return [];
  }
}

export { parseScarcityCount };
