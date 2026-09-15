import { jsonError, requirePermission } from "@/server/adminAuth";
import { listLeads } from "@/server/leads";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    const leads = await listLeads(120);
    return Response.json({ ok: true, leads });
  } catch (error) {
    return jsonError(error);
  }
}
