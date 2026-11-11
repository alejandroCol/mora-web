import { jsonError, requirePermission } from "@/server/adminAuth";
import { deleteFeatureFlag, listFeatureFlags, saveFeatureFlag } from "@/server/developer";

type Ctx = { params: Promise<{ key: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const staff = await requirePermission(request, "developer");
    const { key } = await ctx.params;
    const body = (await request.json()) as { stage?: unknown; testers?: unknown; note?: unknown };
    const flag = await saveFeatureFlag({
      key,
      stage: body.stage,
      testers: body.testers,
      note: body.note,
      by: staff.uid,
    });
    return Response.json({ ok: true, flag, flags: await listFeatureFlags() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "developer");
    const { key } = await ctx.params;
    await deleteFeatureFlag(key);
    return Response.json({ ok: true, flags: await listFeatureFlags() });
  } catch (error) {
    return jsonError(error);
  }
}
