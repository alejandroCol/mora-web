import { jsonError, requirePermission } from "@/server/adminAuth";
import { financeSnapshot, setLoanInstallmentPaid } from "@/server/finance";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "budget");
    const { id } = await ctx.params;
    const body = (await request.json()) as { number?: number; paid?: boolean };
    if (!body.number) {
      return Response.json({ ok: false, error: "Cuál cuota." }, { status: 400 });
    }
    await setLoanInstallmentPaid({
      id,
      number: body.number,
      paid: body.paid !== false,
    });
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}
