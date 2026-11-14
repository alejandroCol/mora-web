import type { AdsPilotSettings } from "@/ads/types";
import { COLLECTIONS } from "@/commerce/paths";
import { adminDb } from "@/lib/firebaseAdmin";

/** Límites y metas del piloto. Solo Admin SDK: las reglas de Firestore no dejan leerlo al cliente. */
const DOC = `${COLLECTIONS.settings}/adsPilot`;

/**
 * Arranca apagado y conservador: no sube presupuesto solo, y el tope diario
 * queda un poco por encima de lo que la cuenta ya gasta.
 */
export const PILOT_DEFAULTS: AdsPilotSettings = {
  enabled: false,
  autoPause: true,
  autoScale: false,
  maxDailyTotal: 100_000,
  maxDailyPerCampaign: 50_000,
  scaleStepPct: 20,
  targetCostPerChat: 1_500,
  targetCostPerSale: 60_000,
  minSpendToJudge: 8_000,
  notifyEmail: "",
  updatedAt: 0,
};

function amount(value: unknown, fallback: number, max = 100_000_000) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 && number <= max ? number : fallback;
}

function sanitize(raw: Partial<AdsPilotSettings>, base: AdsPilotSettings): AdsPilotSettings {
  const email = typeof raw.notifyEmail === "string" ? raw.notifyEmail.trim().toLowerCase() : base.notifyEmail;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : base.enabled,
    autoPause: typeof raw.autoPause === "boolean" ? raw.autoPause : base.autoPause,
    autoScale: typeof raw.autoScale === "boolean" ? raw.autoScale : base.autoScale,
    maxDailyTotal: amount(raw.maxDailyTotal, base.maxDailyTotal),
    maxDailyPerCampaign: amount(raw.maxDailyPerCampaign, base.maxDailyPerCampaign),
    // Subir más de 30 % de un golpe reinicia el aprendizaje de Meta.
    scaleStepPct: Math.min(30, Math.max(5, amount(raw.scaleStepPct, base.scaleStepPct, 100))),
    targetCostPerChat: amount(raw.targetCostPerChat, base.targetCostPerChat),
    targetCostPerSale: amount(raw.targetCostPerSale, base.targetCostPerSale),
    minSpendToJudge: amount(raw.minSpendToJudge, base.minSpendToJudge),
    notifyEmail: email === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : base.notifyEmail,
    updatedAt: base.updatedAt,
  };
}

export async function loadAdsPilotSettings(): Promise<AdsPilotSettings> {
  const snap = await adminDb().doc(DOC).get();
  if (!snap.exists) return PILOT_DEFAULTS;
  const data = snap.data() as Partial<AdsPilotSettings>;
  return { ...sanitize(data, PILOT_DEFAULTS), updatedAt: Number(data.updatedAt) || 0 };
}

export async function saveAdsPilotSettings(patch: Partial<AdsPilotSettings>): Promise<AdsPilotSettings> {
  const current = await loadAdsPilotSettings();
  const next = { ...sanitize(patch, current), updatedAt: Date.now() };
  await adminDb().doc(DOC).set(next, { merge: true });
  return next;
}
