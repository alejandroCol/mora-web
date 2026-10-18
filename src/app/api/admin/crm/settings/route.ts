import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadCrmSettings, saveCrmSettings } from "@/server/crm";
import { saveGrowthSettings } from "@/server/growthSettings";
import type { CrmSettings } from "@/growth/types";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const settings = await loadCrmSettings();
    return Response.json({ ok: true, settings });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const body = (await request.json()) as Partial<CrmSettings> & { welcome?: string };
    const settings = await saveCrmSettings(body);
    if (typeof body.welcome === "string") {
      await saveGrowthSettings({ whatsappWelcome: body.welcome });
    }
    return Response.json({ ok: true, settings, welcome: body.welcome?.trim() ?? undefined });
  } catch (error) {
    return jsonError(error);
  }
}
