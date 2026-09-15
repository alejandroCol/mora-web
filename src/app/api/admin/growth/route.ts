import { jsonError, requirePermission } from "@/server/adminAuth";
import {
  loadGrowthSettings,
  publicAdminGrowth,
  saveGrowthSettings,
} from "@/server/growthSettings";
import { siteOrigin } from "@/lib/site";
import { webhookUrl } from "@/server/whatsapp";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    const settings = await loadGrowthSettings();
    return Response.json({
      ok: true,
      settings: publicAdminGrowth(settings),
      webhook: webhookUrl(siteOrigin()),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requirePermission(request, "growth");
    const body = (await request.json()) as Record<string, unknown>;
    const settings = await saveGrowthSettings(body);
    return Response.json({
      ok: true,
      settings: publicAdminGrowth(settings),
      webhook: webhookUrl(siteOrigin()),
    });
  } catch (error) {
    return jsonError(error);
  }
}
