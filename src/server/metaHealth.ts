import { COLLECTIONS } from "@/commerce/paths";
import { adminDb } from "@/lib/firebaseAdmin";

/** Último resultado de cada envío de conversiones a Meta. Solo Admin SDK. */
const DOC = `${COLLECTIONS.settings}/adsHealth`;

export type MetaSignalKind = "capi" | "messaging";
export type MetaSignal = { ok: boolean; at: number; error: string; event: string };
export type MetaHealth = Partial<Record<MetaSignalKind, MetaSignal>>;

const last = new Map<MetaSignalKind, { ok: boolean; at: number }>();
const REFRESH_MS = 30 * 60_000;

/**
 * Anota si Meta aceptó el último evento. La web manda un evento por cada visita,
 * así que solo escribe cuando cambia el resultado o cada media hora.
 */
export async function recordMetaSignal(kind: MetaSignalKind, result: { ok: boolean; error?: string; event: string }) {
  const previous = last.get(kind);
  const now = Date.now();
  if (previous && previous.ok === result.ok && now - previous.at < REFRESH_MS) return;
  last.set(kind, { ok: result.ok, at: now });
  const signal: MetaSignal = { ok: result.ok, at: now, error: (result.error ?? "").slice(0, 300), event: result.event };
  await adminDb()
    .doc(DOC)
    .set({ [kind]: signal }, { merge: true })
    .catch(() => undefined);
}

export async function loadMetaHealth(): Promise<MetaHealth> {
  const snap = await adminDb().doc(DOC).get();
  return snap.exists ? (snap.data() as MetaHealth) : {};
}
