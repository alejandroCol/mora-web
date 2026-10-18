import { jsonError, requirePermission } from "@/server/adminAuth";
import { getCrmContact, patchConversation } from "@/server/crm";
import { conversationIdFromPhone } from "@/server/whatsapp";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(request, "whatsapp");
    const { id } = await context.params;
    const contact = await getCrmContact(conversationIdFromPhone(id) || id);
    return Response.json({ ok: true, ...contact });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requirePermission(request, "whatsapp");
    const { id } = await context.params;
    const body = (await request.json()) as Parameters<typeof patchConversation>[1];
    const conversation = await patchConversation(
      conversationIdFromPhone(id) || id,
      body,
      { uid: staff.uid, name: staff.name || staff.email },
    );
    return Response.json({ ok: true, conversation });
  } catch (error) {
    return jsonError(error);
  }
}
