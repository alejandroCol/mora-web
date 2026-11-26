import { jsonError, requirePermission } from "@/server/adminAuth";
import { confirmOrderSizes, getOrder } from "@/server/orders";

type Ctx = { params: Promise<{ id: string }> };

/** Talla puesta por el equipo cuando el cliente la dice por chat. */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const staff = await requirePermission(request, "sales");
    const { id } = await ctx.params;
    const body = (await request.json()) as { sizes?: { index: number; size: number }[] };
    const sizes = (body.sizes ?? []).filter(
      (entry) => Number.isInteger(entry.index) && Number.isInteger(entry.size),
    );
    if (sizes.length === 0) {
      return Response.json({ ok: false, error: "Elige una talla." }, { status: 400 });
    }
    const current = await getOrder(id);
    if (!current) {
      return Response.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }
    const order = await confirmOrderSizes({ orderNumber: current.orderNumber, sizes, by: staff.uid });
    return Response.json({ ok: true, order });
  } catch (error) {
    return jsonError(error);
  }
}
