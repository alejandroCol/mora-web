import { jsonError, requirePermission } from "@/server/adminAuth";
import { dispatchOrderWithHeka, refreshOrderHeka } from "@/server/hekaDispatch";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const staff = await requirePermission(request, "sales");
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const order =
      body.action === "refresh"
        ? await refreshOrderHeka(id, staff.uid)
        : await dispatchOrderWithHeka(id, staff.uid);
    return Response.json({ ok: true, order });
  } catch (error) {
    return jsonError(error);
  }
}
