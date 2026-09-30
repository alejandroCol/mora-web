import type { FinancePurchaseOrder } from "@/commerce/finance";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { deleteOrder, financeSnapshot, updateOrder } from "@/server/finance";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "budget");
    const { id } = await ctx.params;
    const body = (await request.json()) as Partial<FinancePurchaseOrder>;
    await updateOrder(id, body);
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "budget");
    const { id } = await ctx.params;
    await deleteOrder(id);
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}
