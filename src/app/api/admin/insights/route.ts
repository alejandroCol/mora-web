import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadInsights } from "@/server/insights";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "insights");
    const days = Number(new URL(request.url).searchParams.get("days") ?? 7);
    const report = await loadInsights(Number.isFinite(days) ? days : 7);
    return Response.json({ ok: true, report });
  } catch (error) {
    return jsonError(error);
  }
}
