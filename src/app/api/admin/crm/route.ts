import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadCrmWorkspace } from "@/server/crm";
import { loadGrowthSettings } from "@/server/growthSettings";
import { webhookUrl } from "@/server/whatsapp";
import { siteOrigin } from "@/lib/site";

export async function GET(request: Request) {
  try {
    const staff = await requirePermission(request, "whatsapp");
    const [workspace, growth] = await Promise.all([
      loadCrmWorkspace(staff.uid),
      loadGrowthSettings(),
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
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
