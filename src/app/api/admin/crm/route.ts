import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadCrmWorkspace } from "@/server/crm";
import { loadGrowthSettings } from "@/server/growthSettings";
import { webhookUrl } from "@/server/whatsapp";
import { loadWhatsAppUsage } from "@/server/whatsappUsage";
import { loadWhatsAppWebhookDebug } from "@/server/whatsappWebhookDebug";
import { siteOrigin } from "@/lib/site";

export async function GET(request: Request) {
  try {
    const staff = await requirePermission(request, "whatsapp");
    const workspace = await loadCrmWorkspace(staff.uid);
    const [growth, usage, webhookDebug] = await Promise.all([
      loadGrowthSettings(),
      loadWhatsAppUsage(workspace.settings.templates),
      loadWhatsAppWebhookDebug(),
    ]);
    return Response.json({
      ok: true,
      ...workspace,
      usage,
      connection: {
        ready: Boolean(
          growth.whatsappPhoneNumberId &&
            growth.whatsappAccessToken &&
            growth.whatsappDisplayNumber,
        ),
        displayNumber: growth.whatsappDisplayNumber,
        webhook: webhookUrl(siteOrigin()),
        welcome: Boolean(growth.whatsappWelcome.trim()),
        welcomeText: growth.whatsappWelcome,
        webhookDebug,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
