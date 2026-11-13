import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadCrmSettings } from "@/server/crm";
import { loadWhatsAppUsage } from "@/server/whatsappUsage";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const settings = await loadCrmSettings();
    const usage = await loadWhatsAppUsage(settings.templates);
    return Response.json({ ok: true, usage });
  } catch (error) {
    return jsonError(error);
  }
}
