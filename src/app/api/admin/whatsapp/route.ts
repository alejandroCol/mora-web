import { isCrmDesk } from "@/crm/labels";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { startCrmChat } from "@/server/crm";
import { listConversations } from "@/server/whatsapp";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const conversations = await listConversations(80);
    return Response.json({ ok: true, conversations });
  } catch (error) {
    return jsonError(error);
  }
}

/** Nuevo chat: Mora escribe primero con una plantilla aprobada. */
export async function POST(request: Request) {
  try {
    const staff = await requirePermission(request, "whatsapp");
    const body = (await request.json()) as {
      phone?: string;
      name?: string;
      templateId?: string;
      desk?: string;
    };
    const result = await startCrmChat(
      {
        phone: String(body.phone ?? ""),
        name: String(body.name ?? ""),
        templateId: String(body.templateId ?? ""),
        desk: isCrmDesk(body.desk) ? body.desk : "sales",
      },
      { uid: staff.uid, name: staff.name || staff.email },
    );
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
