import { jsonError, requirePermission } from "@/server/adminAuth";
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
