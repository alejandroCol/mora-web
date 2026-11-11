import { jsonError, requirePermission } from "@/server/adminAuth";
import { deleteSpiritCode, listSpiritCodes, updateSpiritCode } from "@/server/developer";

type Ctx = { params: Promise<{ code: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "developer");
    const { code } = await ctx.params;
    const body = (await request.json()) as {
      active?: unknown;
      maxUses?: unknown;
      expiresAt?: unknown;
      note?: unknown;
    };
    const updated = await updateSpiritCode(code, body);
    return Response.json({ ok: true, code: updated, codes: await listSpiritCodes() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "developer");
    const { code } = await ctx.params;
    await deleteSpiritCode(code);
    return Response.json({ ok: true, codes: await listSpiritCodes() });
  } catch (error) {
    return jsonError(error);
  }
}
