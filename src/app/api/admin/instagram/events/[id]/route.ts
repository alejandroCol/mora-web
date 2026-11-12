import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadGrowthSettings } from "@/server/growthSettings";
import { listInstagramEvents, retryInstagramEvent } from "@/server/instagram/automations";
import { connectionOf } from "@/server/instagram/graph";

/** Reintenta un DM que falló o quedó en cola. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(request, "growth");
    const { id } = await context.params;
    const status = await retryInstagramEvent(id, connectionOf(await loadGrowthSettings()));
    return Response.json({ ok: true, status, events: await listInstagramEvents() });
  } catch (error) {
    return jsonError(error);
  }
}
