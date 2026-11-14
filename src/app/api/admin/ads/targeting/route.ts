import { requirePermission } from "@/server/adminAuth";
import { adsError } from "@/server/metaAds/http";
import { estimateSegment, searchInterests, searchPlaces } from "@/server/metaAds/targeting";

/** Buscador de intereses y de ciudades o departamentos de Colombia. */
export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    if (url.searchParams.get("type") === "place") {
      return Response.json({ ok: true, places: await searchPlaces(q) });
    }
    return Response.json({ ok: true, interests: await searchInterests(q) });
  } catch (error) {
    return adsError(error);
  }
}

/** Cuánta gente cabe en una segmentación, con los avisos antes de gastar. */
export async function POST(request: Request) {
  try {
    await requirePermission(request, "growth");
    const body = (await request.json()) as { segment?: unknown };
    return Response.json({ ok: true, estimate: await estimateSegment(body.segment as never) });
  } catch (error) {
    return adsError(error);
  }
}
