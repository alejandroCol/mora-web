import type { DocumentData } from "firebase-admin/firestore";
import {
  FLAG_STAGES,
  GIFT_SPIRITS,
  KNOWN_FLAGS,
  cleanTesters,
  isFlagKey,
  isSpiritCodeFormat,
  normalizeSpiritCode,
  type FeatureFlagRecord,
  type FlagStage,
  type SpiritCodeRecord,
} from "@/commerce/developer";
import { COLLECTIONS } from "@/commerce/paths";
import { adminDb } from "@/lib/firebaseAdmin";

function fail(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

function cleanNote(raw: unknown) {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 160);
}

/* ── Feature flags ─────────────────────────────────────────────────────── */

function flags() {
  return adminDb().collection(COLLECTIONS.featureFlags);
}

function isKnownFlag(key: string) {
  return KNOWN_FLAGS.some((flag) => flag.key === key);
}

function asFlag(key: string, data: DocumentData | undefined): FeatureFlagRecord {
  const stage = FLAG_STAGES.includes(data?.stage) ? (data?.stage as FlagStage) : "off";
  const note = cleanNote(data?.note);
  return {
    key,
    stage,
    testers: cleanTesters(data?.testers),
    ...(note ? { note } : {}),
    updatedAt: Number(data?.updatedAt ?? 0),
    ...(typeof data?.updatedBy === "string" ? { updatedBy: data.updatedBy } : {}),
    known: isKnownFlag(key),
  };
}

/** Las que la app conoce primero (aunque nadie las haya tocado: apagadas), luego las sueltas. */
export async function listFeatureFlags(): Promise<FeatureFlagRecord[]> {
  const snap = await flags().get();
  const stored = new Map(snap.docs.map((doc) => [doc.id, asFlag(doc.id, doc.data())]));
  const known = KNOWN_FLAGS.map((flag) => stored.get(flag.key) ?? asFlag(flag.key, undefined));
  const loose = [...stored.values()]
    .filter((flag) => !flag.known)
    .sort((a, b) => a.key.localeCompare(b.key));
  return [...known, ...loose];
}

export async function saveFeatureFlag(input: {
  key: string;
  stage?: unknown;
  testers?: unknown;
  note?: unknown;
  by: string;
  /** Crear una clave suelta: falla si ya existe. */
  create?: boolean;
}): Promise<FeatureFlagRecord> {
  if (!isFlagKey(input.key)) {
    throw fail("La clave va en minúsculas: letras, números y guion bajo (2 a 40), empezando por letra.");
  }
  const ref = flags().doc(input.key);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (input.create && (snap.exists || isKnownFlag(input.key))) throw fail("Esa flag ya existe.", 409);
    const current = asFlag(input.key, snap.data());
    const stage =
      input.stage === undefined
        ? current.stage
        : FLAG_STAGES.includes(input.stage as FlagStage)
          ? (input.stage as FlagStage)
          : null;
    if (!stage) throw fail("Etapa inválida.");
    const testers = input.testers === undefined ? current.testers : cleanTesters(input.testers);
    const note = input.note === undefined ? (current.note ?? "") : cleanNote(input.note);
    const next = { stage, testers, note, updatedAt: Date.now(), updatedBy: input.by };
    tx.set(ref, next);
    return asFlag(input.key, next);
  });
}

/** Borra el documento. Una flag conocida vuelve a su valor de fábrica (apagada). */
export async function deleteFeatureFlag(key: string) {
  if (!isFlagKey(key)) throw fail("Esa flag no existe.", 404);
  await flags().doc(key).delete();
}

/* ── Códigos de espíritu ───────────────────────────────────────────────── */

function codes() {
  return adminDb().collection(COLLECTIONS.spiritCodes);
}

function asSpiritCode(id: string, data: DocumentData | undefined): SpiritCodeRecord {
  const maxUses =
    typeof data?.maxUses === "number" && Number.isFinite(data.maxUses) && data.maxUses > 0
      ? Math.round(data.maxUses)
      : null;
  const expiresAt =
    typeof data?.expiresAt === "number" && Number.isFinite(data.expiresAt) && data.expiresAt > 0
      ? data.expiresAt
      : null;
  const note = cleanNote(data?.note);
  return {
    code: id,
    lineage: String(data?.lineage ?? ""),
    active: data?.active !== false,
    maxUses,
    uses: Math.max(0, Math.round(Number(data?.uses ?? 0))),
    expiresAt,
    ...(note ? { note } : {}),
    createdAt: Number(data?.createdAt ?? 0),
    ...(typeof data?.createdBy === "string" ? { createdBy: data.createdBy } : {}),
    updatedAt: Number(data?.updatedAt ?? data?.createdAt ?? 0),
  };
}

function cleanLineage(raw: unknown) {
  const lineage = typeof raw === "string" ? raw : "";
  if (!GIFT_SPIRITS.some((spirit) => spirit.lineage === lineage)) throw fail("Elige el espíritu que regala.");
  return lineage;
}

function cleanMaxUses(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "string" ? Number(raw.replace(/[^\d]/g, "")) : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(1_000_000, Math.round(n));
}

function cleanExpiresAt(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const at = Number(raw);
  if (!Number.isFinite(at) || at <= 0) return null;
  return Math.round(at);
}

export async function listSpiritCodes(): Promise<SpiritCodeRecord[]> {
  const snap = await codes().get();
  return snap.docs
    .map((doc) => asSpiritCode(doc.id, doc.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function createSpiritCode(input: {
  code: unknown;
  lineage: unknown;
  maxUses?: unknown;
  expiresAt?: unknown;
  note?: unknown;
  createdBy: string;
}): Promise<SpiritCodeRecord> {
  const code = normalizeSpiritCode(input.code);
  if (!isSpiritCodeFormat(code)) throw fail("El código lleva de 3 a 24 letras o números.");
  const now = Date.now();
  const expiresAt = cleanExpiresAt(input.expiresAt);
  if (expiresAt != null && expiresAt <= now) throw fail("La fecha de vencimiento ya pasó.");
  const next = {
    lineage: cleanLineage(input.lineage),
    active: true,
    maxUses: cleanMaxUses(input.maxUses),
    uses: 0,
    expiresAt,
    note: cleanNote(input.note),
    createdAt: now,
    createdBy: input.createdBy,
    updatedAt: now,
  };
  const ref = codes().doc(code);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) throw fail("Ese código ya existe.", 409);
    tx.set(ref, next);
  });
  return asSpiritCode(code, next);
}

/**
 * Pausar, cambiar tope, vencimiento o nota. El espíritu y los usos no se editan: quien ya canjeó
 * recibió ese espíritu, y `uses` lo lleva la Function dentro de su transacción.
 */
export async function updateSpiritCode(
  raw: string,
  patch: { active?: unknown; maxUses?: unknown; expiresAt?: unknown; note?: unknown },
): Promise<SpiritCodeRecord> {
  const code = normalizeSpiritCode(raw);
  const ref = codes().doc(code);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw fail("Ese código no existe.", 404);
    const next: Record<string, unknown> = { updatedAt: Date.now() };
    if (typeof patch.active === "boolean") next.active = patch.active;
    if ("maxUses" in patch) next.maxUses = cleanMaxUses(patch.maxUses);
    if ("expiresAt" in patch) next.expiresAt = cleanExpiresAt(patch.expiresAt);
    if ("note" in patch) next.note = cleanNote(patch.note);
    tx.set(ref, next, { merge: true });
    return asSpiritCode(code, { ...snap.data(), ...next });
  });
}

/** Borra el código y su lista de canjes. Quien ya lo canjeó **conserva** su espíritu (`spiritGrants`). */
export async function deleteSpiritCode(raw: string) {
  const code = normalizeSpiritCode(raw);
  const ref = codes().doc(code);
  const snap = await ref.get();
  if (!snap.exists) throw fail("Ese código no existe.", 404);
  await adminDb().recursiveDelete(ref);
}
