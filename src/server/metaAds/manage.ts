import { formatAdsMoney } from "@/ads/format";
import type { AdsAction, AdsChange, AdsChangeSource } from "@/ads/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadGrowthSettings } from "../growthSettings";
import { requireAdsManage } from "./access";
import { MetaAdsError, amountToBudget, budgetToAmount, fetchAdSets, fetchCampaigns, graphOne, graphWrite } from "./graph";
import { loadAdsPilotSettings } from "./pilotSettings";
import { clearAdsReportCache } from "./report";

/** Bitácora de cambios hechos desde Mora. Solo Admin SDK. */
const LOG = "adsChangeLog";

const LEVEL_LABEL = { campaign: "campaña", adset: "conjunto", ad: "anuncio" } as const;

function bad(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

type Target = { account_id?: string; name?: string; status?: string; daily_budget?: string };

/**
 * Presupuesto diario que está corriendo: el de la campaña si lo tiene, o la
 * suma de sus conjuntos activos que aún no vencen. `skip` deja una campaña por fuera.
 */
export async function activeDailyBudget(accountId: string, token: string, currency: string, skip = "") {
  const [campaigns, adSets] = await Promise.all([fetchCampaigns(accountId, token), fetchAdSets(accountId, token)]);
  const now = Date.now();
  let total = 0;
  for (const campaign of campaigns) {
    if (campaign.effective_status !== "ACTIVE" || campaign.id === skip) continue;
    if (campaign.stop_time && Date.parse(campaign.stop_time) <= now) continue;
    const own = budgetToAmount(campaign.daily_budget, currency);
    const sets = adSets.filter(
      (set) =>
        set.campaign_id === campaign.id &&
        set.effective_status === "ACTIVE" &&
        !(set.end_time && Date.parse(set.end_time) <= now),
    );
    if (sets.length === 0) continue;
    total += own || sets.reduce((sum, set) => sum + budgetToAmount(set.daily_budget, currency), 0);
  }
  return total;
}

/**
 * Único camino para cambiar algo en Meta desde Mora: comprueba permisos, que el
 * objeto sea de la cuenta conectada y los topes; aplica y deja el cambio en la bitácora.
 */
export async function applyAdsAction(input: {
  action: AdsAction;
  by: { uid: string; name: string };
  source: AdsChangeSource;
  reason?: string;
}): Promise<AdsChange> {
  const access = await requireAdsManage();
  const settings = await loadGrowthSettings();
  const token = settings.metaAdsToken;
  const accountId = settings.metaAdAccountId;
  const currency = settings.metaAdsCurrency || "COP";
  const money = (value: number) => formatAdsMoney(value, currency);
  const { action } = input;

  if (action.kind !== "status" && action.kind !== "budget") throw bad("Cambio no válido.");
  if (!/^\d{6,30}$/.test(action.id)) throw bad("Ese anuncio no existe.");
  const fields = action.level === "ad" ? "account_id,name,status" : "account_id,name,status,daily_budget";
  let target: Target;
  try {
    target = await graphOne<Target>(action.id, { fields }, token);
  } catch {
    throw bad(`Meta no encontró ${LEVEL_LABEL[action.level] === "campaña" ? "esa" : "ese"} ${LEVEL_LABEL[action.level]}.`, 404);
  }
  if (`act_${target.account_id}` !== accountId) throw bad("Eso no pertenece a la cuenta publicitaria de Mora.", 403);

  const limits = await loadAdsPilotSettings();
  const currentBudget = budgetToAmount(target.daily_budget, currency);
  let before = "";
  let after = "";
  let body: Record<string, unknown>;

  if (action.kind === "status") {
    if (action.value !== "ACTIVE" && action.value !== "PAUSED") throw bad("Estado no válido.");
    before = target.status === "ACTIVE" ? "Activa" : "En pausa";
    after = action.value === "ACTIVE" ? "Activa" : "En pausa";
    if (action.value === "ACTIVE" && action.level === "campaign" && limits.maxDailyTotal > 0 && currentBudget > 0) {
      const running = await activeDailyBudget(accountId, token, currency, action.id);
      if (running + currentBudget > limits.maxDailyTotal) {
        throw bad(
          `Al prenderla el presupuesto diario quedaría en ${money(running + currentBudget)} y tu tope es ${money(limits.maxDailyTotal)}. Apaga otra campaña o sube el tope en Piloto.`,
          409,
        );
      }
    }
    body = { status: action.value };
  } else {
    const value = Math.round(Number(action.value));
    if (!Number.isFinite(value) || value <= 0) throw bad("Escribe un presupuesto válido.");
    if (currentBudget <= 0) {
      throw bad("Esta campaña reparte el presupuesto por conjunto de anuncios. Ese cambio se hace en Meta.", 409);
    }
    if (access.minDailyBudget > 0 && value < access.minDailyBudget) {
      throw bad(`Meta no acepta menos de ${money(access.minDailyBudget)} al día en esta cuenta.`);
    }
    if (limits.maxDailyPerCampaign > 0 && value > limits.maxDailyPerCampaign) {
      throw bad(
        `Tu tope por campaña es ${money(limits.maxDailyPerCampaign)} al día. Si quieres más, súbelo en Piloto.`,
        409,
      );
    }
    if (value > currentBudget && target.status === "ACTIVE" && limits.maxDailyTotal > 0) {
      const running = await activeDailyBudget(accountId, token, currency, action.id);
      if (running + value > limits.maxDailyTotal) {
        throw bad(
          `Con ese cambio el presupuesto diario total quedaría en ${money(running + value)} y tu tope es ${money(limits.maxDailyTotal)}.`,
          409,
        );
      }
    }
    before = `${money(currentBudget)} al día`;
    after = `${money(value)} al día`;
    body = { daily_budget: amountToBudget(value, currency) };
  }

  const entry: Omit<AdsChange, "id"> = {
    at: Date.now(),
    by: input.by.uid,
    byName: input.by.name,
    source: input.source,
    action,
    targetName: target.name ?? "",
    before,
    after,
    reason: (input.reason ?? "").slice(0, 400),
    ok: true,
  };

  try {
    await graphWrite("POST", action.id, body, token);
  } catch (error) {
    const message = error instanceof MetaAdsError ? error.message : "No se pudo aplicar el cambio.";
    await adminDb()
      .collection(LOG)
      .add({ ...entry, ok: false, error: message });
    throw bad(`Meta no aceptó el cambio: ${message}`, 502);
  }

  const ref = await adminDb().collection(LOG).add(entry);
  clearAdsReportCache();
  return { ...entry, id: ref.id };
}

export async function listAdsChanges(limit = 40): Promise<AdsChange[]> {
  const snap = await adminDb().collection(LOG).orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((doc) => ({ ...(doc.data() as Omit<AdsChange, "id">), id: doc.id }));
}
