import type { ExpenseCategory } from "@/commerce/finance";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { deleteExpense, financeSnapshot, updateExpense } from "@/server/finance";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "budget");
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      date?: string;
      category?: ExpenseCategory;
      title?: string;
      vendor?: string;
      amountCop?: number;
      notes?: string;
      attachmentIds?: string[];
    };
    await updateExpense(id, body);
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "budget");
    const { id } = await ctx.params;
    await deleteExpense(id);
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}
