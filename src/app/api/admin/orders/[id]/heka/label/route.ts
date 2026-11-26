import { ringsGuideId } from "@/commerce/shipments";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { fetchDropiSticker } from "@/server/dropiClient";
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
          ? ringsGuideId(order)
          : ringsGuideId(order) || order.shipments?.sizer?.hekaGuideId?.trim();
    if (!guideId) {
      return Response.json({ ok: false, error: "Esta venta no tiene guía." }, { status: 404 });
    }
    const byDropi = [order.shipments?.rings, order.shipments?.sizer].some(
      (shipment) =>
        shipment?.guideProvider === "dropi" && shipment.hekaGuideId?.trim() === guideId,
    );
    const pdf = byDropi ? await fetchDropiSticker(guideId) : await fetchHekaSticker(guideId);
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
