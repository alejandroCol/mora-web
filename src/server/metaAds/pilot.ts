import { randomBytes, timingSafeEqual } from "crypto";
import type { AdsChange, AdsDecision, AdsPilotRun, AdsPilotSettings } from "@/ads/types";
import { COLLECTIONS } from "@/commerce/paths";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendAdsDigestEmail } from "../email";
import { syncAudiences } from "./audiences";
import { applyAdsAction } from "./manage";
import { buildAdsMonitor } from "./monitor";
import { loadAdsPilotSettings } from "./pilotSettings";

const RUNS = "adsPilotRuns";
const LOG = "adsChangeLog";
/** Llave de la tarea programada. Solo Admin SDK: la lee la Function que llama a `/api/cron/ads`. */
const CRON_DOC = `${COLLECTIONS.settings}/adsCron`;

const PILOT = { uid: "pilot", name: "Piloto automático" };
/** Entre una subida y la siguiente Meta necesita unos días para acomodarse. */
const SCALE_REST_MS = 3 * 86_400_000;
/** Si una persona tocó la campaña hace poco, el piloto no le lleva la contraria. */
const HUMAN_REST_MS = 86_400_000;
const MAX_ACTIONS_PER_RUN = 6;

function allowed(decision: AdsDecision, settings: AdsPilotSettings) {
  if (!decision.action) return false;
  // «watch» también trae botón de pausar, pero es una sugerencia: el piloto solo actúa sobre lo firme.
  if (decision.verdict === "pause") return settings.autoPause && decision.action.kind === "status";
  if (decision.verdict === "scale") return settings.autoScale && decision.action.kind === "budget";
  return false;
}

async function recentChanges(): Promise<AdsChange[]> {
  const snap = await adminDb()
    .collection(LOG)
    .where("at", ">=", Date.now() - SCALE_REST_MS)
    .get();
  return snap.docs.map((doc) => ({ ...(doc.data() as Omit<AdsChange, "id">), id: doc.id }));
}

/**
 * Una pasada del piloto: monitorea, aplica solo lo que los ajustes permiten
 * (los topes los vuelve a comprobar `applyAdsAction`), guarda qué hizo y avisa.
 * Apagado, solo deja las sugerencias y el correo.
 */
export async function runAdsPilot(
  trigger: AdsPilotRun["trigger"],
  options: { digest?: boolean } = {},
): Promise<AdsPilotRun> {
  const [settings, monitor] = await Promise.all([loadAdsPilotSettings(), buildAdsMonitor()]);
  const applied: AdsPilotRun["applied"] = [];
  const done = new Set<string>();

  if (settings.enabled && monitor.access.canManage) {
    const history = await recentChanges();
    const now = Date.now();
    for (const decision of monitor.decisions) {
      if (applied.length >= MAX_ACTIONS_PER_RUN) break;
      if (!allowed(decision, settings) || !decision.action) continue;
      const touched = history.filter((change) => change.ok && change.action.id === decision.action!.id);
      if (touched.some((change) => change.source !== "pilot" && now - change.at < HUMAN_REST_MS)) continue;
      if (decision.action.kind === "budget" && touched.some((change) => change.action.kind === "budget")) continue;
      try {
        await applyAdsAction({ action: decision.action, by: PILOT, source: "pilot", reason: decision.why });
        applied.push({ title: decision.title, target: decision.targetName, ok: true });
        done.add(decision.id);
      } catch (error) {
        applied.push({
          title: decision.title,
          target: decision.targetName,
          ok: false,
          error: error instanceof Error ? error.message : "No se pudo aplicar.",
        });
      }
    }
  }

  // Una vez al día, las listas al día para que las exclusiones sirvan. Si falla, el piloto sigue.
  if (options.digest && monitor.access.canManage) {
    await syncAudiences().catch((error) => console.error("[ads pilot] audiencias", error));
  }

  const pending = monitor.decisions.filter(
    (decision) => !done.has(decision.id) && decision.verdict !== "keep" && decision.verdict !== "watch",
  );
  const run: Omit<AdsPilotRun, "id"> = {
    at: Date.now(),
    trigger,
    headline: monitor.headline,
    applied,
    suggested: pending.length,
  };
  const ref = await adminDb().collection(RUNS).add(run);

  if (settings.notifyEmail && (options.digest || applied.length > 0)) {
    await sendAdsDigestEmail({
      to: settings.notifyEmail,
      headline: monitor.headline,
      applied,
      pending: pending.slice(0, 8).map((decision) => ({
        title: decision.title,
        target: decision.targetName,
        why: decision.why,
      })),
    }).catch((error) => console.error("[ads pilot] correo", error));
  }

  return { ...run, id: ref.id };
}

export async function listPilotRuns(limit = 8): Promise<AdsPilotRun[]> {
  const snap = await adminDb().collection(RUNS).orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((doc) => ({ ...(doc.data() as Omit<AdsPilotRun, "id">), id: doc.id }));
}

/** La llave se crea sola la primera vez; nunca sale del servidor. */
export async function ensureCronKey() {
  const ref = adminDb().doc(CRON_DOC);
  const snap = await ref.get();
  const current = snap.exists ? String((snap.data() as { key?: string }).key ?? "") : "";
  if (current.length >= 32) return current;
  const key = randomBytes(32).toString("hex");
  await ref.set({ key, createdAt: Date.now() }, { merge: true });
  return key;
}

export async function isCronKey(given: string) {
  if (!given) return false;
  const expected = Buffer.from(await ensureCronKey());
  const got = Buffer.from(given);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
