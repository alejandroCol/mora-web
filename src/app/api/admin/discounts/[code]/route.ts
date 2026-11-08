import { jsonError, requirePermission } from "@/server/adminAuth";
import {
  deleteDiscountCode,
  listDiscountCodes,
  updateDiscountCode,
} from "@/server/discountCodes";

type Ctx = { params: Promise<{ code: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "discounts");
    const { code } = await ctx.params;
    const body = (await request.json()) as {
      active?: unknown;
      maxUses?: unknown;
      note?: unknown;
    };
    const updated = await updateDiscountCode(code, body);
    const codes = await listDiscountCodes();
    return Response.json({ ok: true, code: updated, codes });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "discounts");
    const { code } = await ctx.params;
    await deleteDiscountCode(code);
    const codes = await listDiscountCodes();
    return Response.json({ ok: true, codes });
  } catch (error) {
    return jsonError(error);
  }
}
