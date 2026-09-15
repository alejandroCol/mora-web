import type { OrderStatus } from "@/commerce/types";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { getOrder, transitionOrder } from "@/server/orders";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "sales");
    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order) {
      return Response.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }
    return Response.json({ ok: true, order });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const staff = await requirePermission(request, "sales");
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      status?: OrderStatus;
      trackingNumber?: string;
      note?: string;
    };
    if (!body.status) {
      return Response.json({ ok: false, error: "Estado requerido." }, { status: 400 });
    }
    const order = await transitionOrder({
      orderId: id,
      to: body.status,
      by: staff.uid,
      trackingNumber: body.trackingNumber,
      note: body.note,
    });
    return Response.json({ ok: true, order });
  } catch (error) {
    return jsonError(error);
  }
}
