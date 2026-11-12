import { jsonError, requirePermission } from "@/server/adminAuth";
import { listAutomations, listInstagramEvents } from "@/server/instagram/automations";
import { loadInstagramStatus } from "@/server/instagram/connection";

/** Todo lo que pinta Automatizaciones: conexión, reglas e historial. */
export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    const [status, automations, events] = await Promise.all([
      loadInstagramStatus(),
      listAutomations(),
      listInstagramEvents(),
    ]);
    return Response.json({ ok: true, status, automations, events });
  } catch (error) {
    return jsonError(error);
  }
}
