import { jsonError, requirePermission } from "@/server/adminAuth";
import { financeSnapshot, recordOrderAsExpenses } from "@/server/finance";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission(request, "budget");
    const { id } = await ctx.params;
    await recordOrderAsExpenses(id, actor.uid);
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}
