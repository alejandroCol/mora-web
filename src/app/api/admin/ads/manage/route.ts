import type { AdsAction, AdsChangeSource, AdsLevel } from "@/ads/types";
import { requirePermission } from "@/server/adminAuth";
import { loadAdsAccess } from "@/server/metaAds/access";
import { adsError } from "@/server/metaAds/http";
import { applyAdsAction, listAdsChanges } from "@/server/metaAds/manage";

const LEVELS: AdsLevel[] = ["campaign", "adset", "ad"];

function parseAction(raw: unknown): AdsAction | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id : "";
  if (value.kind === "status" && LEVELS.includes(value.level as AdsLevel)) {
    if (value.value !== "ACTIVE" && value.value !== "PAUSED") return null;
    return { kind: "status", level: value.level as AdsLevel, id, value: value.value };
  }
  if (value.kind === "budget" && value.level === "campaign") {
    return { kind: "budget", level: "campaign", id, value: Number(value.value) };
  }
  return null;
}

/** Qué se puede hacer y los últimos cambios hechos desde Mora. */
export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    const [access, changes] = await Promise.all([loadAdsAccess({ fresh }), listAdsChanges()]);
    return Response.json({ ok: true, access, changes });
  } catch (error) {
    return adsError(error);
  }
}

/** Pausar, activar o cambiar presupuesto. */
export async function POST(request: Request) {
  try {
    const staff = await requirePermission(request, "growth");
    const body = (await request.json()) as { action?: unknown; reason?: string; source?: string };
    const action = parseAction(body.action);
    if (!action) return Response.json({ ok: false, error: "Cambio no válido." }, { status: 400 });
    const source: AdsChangeSource = body.source === "monitor" ? "monitor" : "panel";
    const change = await applyAdsAction({
      action,
      by: { uid: staff.uid, name: staff.name || staff.email },
      source,
      reason: typeof body.reason === "string" ? body.reason : "",
    });
    return Response.json({ ok: true, change });
  } catch (error) {
    return adsError(error);
  }
}
