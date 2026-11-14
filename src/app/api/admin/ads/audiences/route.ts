import { requirePermission } from "@/server/adminAuth";
import { loadAdsAccess } from "@/server/metaAds/access";
import { loadAudiencesState, syncAudiences } from "@/server/metaAds/audiences";
import { adsError } from "@/server/metaAds/http";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    const [state, access] = await Promise.all([loadAudiencesState(), loadAdsAccess()]);
    return Response.json({ ok: true, state, access });
  } catch (error) {
    return adsError(error);
  }
}

/** Crea en Meta las audiencias que falten y sube las listas (solo huellas SHA-256). */
export async function POST(request: Request) {
  try {
    await requirePermission(request, "growth");
    const state = await syncAudiences();
    return Response.json({ ok: true, state, access: await loadAdsAccess() });
  } catch (error) {
    return adsError(error);
  }
}
