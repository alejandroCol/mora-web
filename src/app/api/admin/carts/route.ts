import { jsonError, requirePermission } from "@/server/adminAuth";
import { listAbandonedCarts } from "@/server/abandonedCarts";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "sales");
    const carts = await listAbandonedCarts();
    return Response.json({ ok: true, carts });
  } catch (error) {
    return jsonError(error);
  }
}
