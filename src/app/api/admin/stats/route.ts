import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadStats } from "@/server/stats";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "stats");
    const stats = await loadStats(30);
    return Response.json({ ok: true, stats });
  } catch (error) {
    return jsonError(error);
  }
}
