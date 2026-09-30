import type { LoanDraft } from "@/commerce/finance";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { deleteLoan, financeSnapshot, updateLoan } from "@/server/finance";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "budget");
    const { id } = await ctx.params;
    const body = (await request.json()) as Partial<LoanDraft>;
    await updateLoan(id, body);
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "budget");
    const { id } = await ctx.params;
    await deleteLoan(id);
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}
