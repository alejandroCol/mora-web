import { jsonError, requirePermission } from "@/server/adminAuth";
import { fetchFreshPromoSettings, loadPromoReports, savePromoSettings } from "@/server/promos";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "discounts");
    const [settings, reports] = await Promise.all([fetchFreshPromoSettings(), loadPromoReports()]);
    return Response.json({ ok: true, settings, reports, now: Date.now() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const staff = await requirePermission(request, "discounts");
    const body = (await request.json()) as Parameters<typeof savePromoSettings>[0];
    const settings = await savePromoSettings(
      { black: body?.black, horaLoca: body?.horaLoca },
      staff.uid,
    );
    const reports = await loadPromoReports();
    return Response.json({ ok: true, settings, reports, now: Date.now() });
  } catch (error) {
    return jsonError(error);
  }
}
