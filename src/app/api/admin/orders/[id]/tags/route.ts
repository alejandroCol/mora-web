import { jsonError, requirePermission } from "@/server/adminAuth";
import { clearOrderAlistar, markOrderAlistar } from "@/server/orderTags";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Etiqueta interna de logística. Body: `{ tag: "alistar" }`. */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const staff = await requirePermission(request, "sales");
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { tag?: string };
    if (body.tag !== "alistar") {
      return Response.json({ ok: false, error: "Etiqueta desconocida." }, { status: 400 });
    }
    const actor = { uid: staff.uid, name: staff.name || staff.email };
    return Response.json({ ok: true, order: await markOrderAlistar({ orderId: id, actor }) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "sales");
    const { id } = await ctx.params;
    const tag = new URL(request.url).searchParams.get("tag");
    if (tag !== "alistar") {
      return Response.json({ ok: false, error: "Etiqueta desconocida." }, { status: 400 });
    }
    return Response.json({ ok: true, order: await clearOrderAlistar(id) });
  } catch (error) {
    return jsonError(error);
  }
}
