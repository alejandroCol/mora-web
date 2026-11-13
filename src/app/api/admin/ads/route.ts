import { ADS_RANGES, type AdsRange } from "@/ads/types";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadAdsConnection } from "@/server/metaAds/connection";
import { MetaAdsError } from "@/server/metaAds/graph";
import { buildAdsReport } from "@/server/metaAds/report";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    const url = new URL(request.url);
    const asked = url.searchParams.get("range") as AdsRange | null;
    const range: AdsRange = asked && ADS_RANGES.includes(asked) ? asked : "7d";
    const connection = await loadAdsConnection();
    if (!connection.connected) return Response.json({ ok: true, connection, report: null });
    try {
      const report = await buildAdsReport(range, { fresh: url.searchParams.get("fresh") === "1" });
      return Response.json({ ok: true, connection, report });
    } catch (error) {
      if (!(error instanceof MetaAdsError)) throw error;
      const message =
        error.code === 190
          ? "El token de anuncios venció o lo revocaron. Conéctalo de nuevo."
          : `Meta no entregó los datos: ${error.message}`;
      return Response.json({ ok: false, connection, report: null, error: message }, { status: 502 });
    }
  } catch (error) {
    return jsonError(error);
  }
}
