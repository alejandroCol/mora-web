import { jsonError, requirePermission } from "@/server/adminAuth";
import { voidGift } from "@/server/gifts";

type Ctx = { params: Promise<{ id: string }> };

/** Anula el regalo y devuelve sus piezas al inventario. */
export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const staff = await requirePermission(request, "sales_manual");
    const { id } = await ctx.params;
    const gift = await voidGift(id, staff);
    return Response.json({ ok: true, gift });
  } catch (error) {
    return jsonError(error);
  }
}
