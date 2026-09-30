import { jsonError, requirePermission } from "@/server/adminAuth";
import { financeSnapshot } from "@/server/finance";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "budget");
    const snapshot = await financeSnapshot();
    return Response.json({ ok: true, ...snapshot });
  } catch (error) {
    return jsonError(error);
  }
}
