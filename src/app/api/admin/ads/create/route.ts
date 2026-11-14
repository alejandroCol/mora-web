import { requirePermission } from "@/server/adminAuth";
import { createAdsCampaign, loadCreateOptions } from "@/server/metaAds/create";
import { adsError } from "@/server/metaAds/http";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    return Response.json({ ok: true, options: await loadCreateOptions() });
  } catch (error) {
    return adsError(error);
  }
}

/** Crea la campaña en pausa. Prenderla es un paso aparte, desde el panel. */
export async function POST(request: Request) {
  try {
    const staff = await requirePermission(request, "growth");
    const created = await createAdsCampaign(await request.json(), {
      uid: staff.uid,
      name: staff.name || staff.email,
    });
    return Response.json({ ok: true, created });
  } catch (error) {
    return adsError(error);
  }
}
