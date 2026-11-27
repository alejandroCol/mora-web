import { roleHasPermission } from "@/commerce/roles";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { clearOrderFollowUp, markOrderFollowUp, sendOrderFollowUp } from "@/server/orderFollowUp";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Seguimiento de entrega. Body: `{ mode: "whatsapp" | "manual", force?: boolean }`.
 * `whatsapp` manda la plantilla «Post-entrega» por el CRM; `manual` solo pone la etiqueta.
 */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const staff = await requirePermission(request, "sales");
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { mode?: string; force?: boolean };
    const actor = { uid: staff.uid, name: staff.name || staff.email };
    if (body.mode === "manual") {
      return Response.json({ ok: true, order: await markOrderFollowUp({ orderId: id, actor }) });
    }
    if (!roleHasPermission(staff.role, "whatsapp")) {
      return Response.json({ ok: false, error: "Este rol no puede escribir por WhatsApp." }, { status: 403 });
    }
    const order = await sendOrderFollowUp({ orderId: id, actor, force: body.force === true });
    return Response.json({ ok: true, order });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "sales");
    const { id } = await ctx.params;
    return Response.json({ ok: true, order: await clearOrderFollowUp(id) });
  } catch (error) {
    return jsonError(error);
  }
}
