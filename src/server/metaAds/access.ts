import type { AdsAccess } from "@/ads/types";
import { loadGrowthSettings } from "../growthSettings";
import { budgetToAmount, graphOne } from "./graph";

const cache = new Map<string, AdsAccess>();
const CACHE_MS = 5 * 60_000;

/** Tareas de la cuenta que permiten crear y cambiar anuncios. `ANALYZE` solo deja ver. */
const WRITE_TASKS = ["ADVERTISE", "MANAGE"];

/**
 * Pregunta a Meta qué puede hacer el token: no basta con que la app lo pida.
 * Hacen falta las dos cosas: el permiso `ads_management` en el token y que el
 * usuario del sistema tenga «Administrar campañas» en la cuenta publicitaria.
 */
export async function loadAdsAccess(options: { fresh?: boolean } = {}): Promise<AdsAccess> {
  const settings = await loadGrowthSettings();
  const token = settings.metaAdsToken;
  const accountId = settings.metaAdAccountId;
  if (!token || !accountId) {
    return { canManage: false, missing: ["Conecta la cuenta publicitaria."], minDailyBudget: 0, checkedAt: Date.now() };
  }

  const key = `${accountId}:${token.slice(-10)}`;
  const hit = cache.get(key);
  if (!options.fresh && hit && Date.now() - hit.checkedAt < CACHE_MS) return hit;

  const [debug, account] = await Promise.all([
    graphOne<{ data?: { scopes?: string[] } }>("debug_token", { input_token: token }, token).catch(() => null),
    graphOne<{ user_tasks?: string[]; min_daily_budget?: number; account_status?: number }>(
      accountId,
      { fields: "user_tasks,min_daily_budget,account_status" },
      token,
    ).catch(() => null),
  ]);

  const missing: string[] = [];
  if (!debug || !account) {
    missing.push("Meta no respondió al revisar los permisos. Intenta de nuevo en un momento.");
  } else {
    const scopes = debug.data?.scopes ?? [];
    if (!scopes.includes("ads_management")) {
      missing.push(
        "Al token le falta el permiso ads_management. En Usuarios del sistema genera uno nuevo marcando ads_management y ads_read, y pégalo en Anuncios › Resultados.",
      );
    }
    const tasks = account.user_tasks ?? [];
    if (!tasks.some((task) => WRITE_TASKS.includes(task))) {
      missing.push(
        "El usuario del sistema solo puede ver la cuenta. En Usuarios del sistema › Asignar activos › Cuentas publicitarias, dale «Administrar campañas».",
      );
    }
    if (account.account_status !== 1) {
      missing.push("La cuenta publicitaria no está activa en Meta. Revisa el método de pago.");
    }
  }

  const access: AdsAccess = {
    canManage: missing.length === 0,
    missing,
    minDailyBudget: budgetToAmount(String(account?.min_daily_budget ?? 0), settings.metaAdsCurrency || "COP"),
    checkedAt: Date.now(),
  };
  // Un fallo de red no se guarda: la próxima consulta vuelve a preguntar.
  if (debug && account) cache.set(key, access);
  return access;
}

export function clearAdsAccessCache() {
  cache.clear();
}

/** Corta con un mensaje claro si todavía no se puede escribir en Meta. */
export async function requireAdsManage() {
  const access = await loadAdsAccess();
  if (!access.canManage) {
    throw Object.assign(new Error(`Aún no se puede cambiar anuncios desde Mora. ${access.missing.join(" ")}`), {
      status: 409,
    });
  }
  return access;
}
