import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadCrmWorkspace } from "@/server/crm";
import { instagramReady, loadGrowthSettings } from "@/server/growthSettings";
import { loadWhatsAppSecurity, webhookUrl } from "@/server/whatsapp";
import { loadWhatsAppWebhookDebug } from "@/server/whatsappWebhookDebug";
import { siteOrigin } from "@/lib/site";

export async function GET(request: Request) {
  try {
    const staff = await requirePermission(request, "whatsapp");
    const workspace = await loadCrmWorkspace(staff.uid);
    const [growth, webhookDebug, security] = await Promise.all([
      loadGrowthSettings(),
      loadWhatsAppWebhookDebug(),
      loadWhatsAppSecurity(),
    ]);
    return Response.json({
      ok: true,
      ...workspace,
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
        twoStep: security.twoStep,
        twoStepSetAt: security.twoStepSetAt,
      },
      instagram: {
        ready: instagramReady(growth),
        username: growth.instagramUsername,
        humanAgent: growth.instagramHumanAgent,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
