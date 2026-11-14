import type { AdsPilotSettings } from "@/ads/types";
import { requirePermission } from "@/server/adminAuth";
import { loadAdsAccess } from "@/server/metaAds/access";
import { adsError } from "@/server/metaAds/http";
import { ensureCronKey, listPilotRuns, runAdsPilot } from "@/server/metaAds/pilot";
import { loadAdsPilotSettings, saveAdsPilotSettings } from "@/server/metaAds/pilotSettings";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    // Deja lista la llave con la que la tarea programada llama al piloto.
    await ensureCronKey();
    const [settings, runs, access] = await Promise.all([loadAdsPilotSettings(), listPilotRuns(), loadAdsAccess()]);
    return Response.json({ ok: true, settings, runs, access });
  } catch (error) {
    return adsError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requirePermission(request, "growth");
    const body = (await request.json()) as { settings?: Partial<AdsPilotSettings> };
    return Response.json({ ok: true, settings: await saveAdsPilotSettings(body.settings ?? {}) });
  } catch (error) {
    return adsError(error);
  }
}

/** Una pasada ahora mismo, con los mismos límites que la programada. */
export async function POST(request: Request) {
  try {
    await requirePermission(request, "growth");
    const run = await runAdsPilot("manual");
    return Response.json({ ok: true, run, runs: await listPilotRuns() });
  } catch (error) {
    return adsError(error);
  }
}
