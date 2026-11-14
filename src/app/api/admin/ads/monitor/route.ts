import { requirePermission } from "@/server/adminAuth";
import { loadAdsConnection } from "@/server/metaAds/connection";
import { adsError } from "@/server/metaAds/http";
import { buildAdsMonitor } from "@/server/metaAds/monitor";

/** «Monitorear campañas ahora»: lee Meta y el CRM en este instante. Nunca responde de caché. */
export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    const connection = await loadAdsConnection();
    if (!connection.connected) {
      return Response.json({ ok: false, error: "Conecta la cuenta publicitaria de Meta." }, { status: 409 });
    }
    return Response.json({ ok: true, monitor: await buildAdsMonitor() });
  } catch (error) {
    return adsError(error);
  }
}
