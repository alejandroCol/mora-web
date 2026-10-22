import { jsonError, requirePermission } from "@/server/adminAuth";
import { fetchHekaSticker } from "@/server/hekaClient";
import { getOrder } from "@/server/orders";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "sales");
    const { id } = await ctx.params;
    const leg = new URL(request.url).searchParams.get("leg");
    const order = await getOrder(id);
    if (!order) {
      return Response.json({ ok: false, error: "Esta venta no tiene guía." }, { status: 404 });
    }
    const guideId =
      leg === "sizer"
        ? order.shipments?.sizer?.hekaGuideId?.trim()
        : leg === "rings"
          ? order.shipments?.rings?.hekaGuideId?.trim() ||
            (order.shipping.hekaGuideId !== order.shipments?.sizer?.hekaGuideId
              ? order.shipping.hekaGuideId?.trim()
              : "")
          : order.shipments?.rings?.hekaGuideId?.trim() ||
            order.shipments?.sizer?.hekaGuideId?.trim() ||
            order.shipping.hekaGuideId?.trim();
    if (!guideId) {
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
