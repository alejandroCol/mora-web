import { jsonError, requirePermission } from "@/server/adminAuth";
import { fetchHekaSticker } from "@/server/hekaClient";
import { getOrder } from "@/server/orders";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "sales");
    const { id } = await ctx.params;
    const order = await getOrder(id);
    const guideId = order?.shipping.hekaGuideId?.trim();
    if (!order || !guideId) {
      return Response.json({ ok: false, error: "Esta venta no tiene guía." }, { status: 404 });
    }
    const pdf = await fetchHekaSticker(guideId);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="guia-${order.shipping.trackingNumber || order.orderNumber}.pdf"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
