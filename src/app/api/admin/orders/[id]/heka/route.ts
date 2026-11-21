import { jsonError, requirePermission } from "@/server/adminAuth";
import {
  dispatchOrderWithDropi,
  orderGuideGoesByDropi,
  orderTrackedByDropi,
  quoteOrderWithDropi,
  refreshOrderDropi,
} from "@/server/dropiDispatch";
import { dispatchOrderWithHeka, quoteOrderWithHeka, refreshOrderHeka } from "@/server/hekaDispatch";
import { getOrder } from "@/server/orders";

type Ctx = { params: Promise<{ id: string }> };

/** Guías de una venta. Los anillos salen por Dropi si hay token; el medidor, por Heka. */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const staff = await requirePermission(request, "sales");
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      carrier?: string;
      pickup?: boolean;
    };
    const current = await getOrder(id);
    if (!current) throw new Error("Pedido no encontrado.");
    const carrier = typeof body.carrier === "string" ? body.carrier : undefined;

    if (body.action === "refresh") {
      const order = orderTrackedByDropi(current)
        ? await refreshOrderDropi(id, staff.uid)
        : await refreshOrderHeka(id, staff.uid);
      return Response.json({ ok: true, order });
    }

    const dropi = orderGuideGoesByDropi(current);
    if (body.action === "quote") {
      const quote = dropi
        ? await quoteOrderWithDropi(id)
        : { ...(await quoteOrderWithHeka(id)), provider: "heka" as const };
      return Response.json({ ok: true, quote });
    }
    const order = dropi
      ? await dispatchOrderWithDropi(id, staff.uid, { carrier })
      : await dispatchOrderWithHeka(id, staff.uid, {
          carrier,
          pickup: typeof body.pickup === "boolean" ? body.pickup : undefined,
        });
    return Response.json({ ok: true, order });
  } catch (error) {
    return jsonError(error);
  }
}
