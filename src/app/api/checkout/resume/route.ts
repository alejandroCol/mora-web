import { boldSessionRetry } from "@/server/checkoutSession";
import { boldIsConfigured, requestOrigin } from "@/payments";
import { getOrderByNumber, setOrderBoldReference } from "@/server/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!boldIsConfigured()) {
      return Response.json(
        { ok: false, error: "El pago aún no está configurado." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { orderNumber?: string };
    const orderNumber = body.orderNumber?.trim().toUpperCase() ?? "";
    if (!orderNumber) {
      return Response.json({ ok: false, error: "Falta el número de pedido." }, { status: 400 });
    }

    const order = await getOrderByNumber(orderNumber);
    if (!order) {
      return Response.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }
    if (order.status !== "awaiting_payment") {
      return Response.json({ ok: false, error: "Ese pedido ya no espera pago." }, { status: 409 });
    }
    if (order.expiresAt && order.expiresAt <= Date.now()) {
      return Response.json({ ok: false, error: "El checkout expiró." }, { status: 410 });
    }
    if (order.payment.status === "pending") {
      return Response.json(
        { ok: false, error: "Ese pago sigue en proceso. Espera un momento." },
        { status: 409 },
      );
    }

    const previous = order.payment.boldReference ?? order.payment.wompiReference ?? order.id;
    const origin = requestOrigin(request);
    const session = await boldSessionRetry(order, origin, previous);
    if (session.reference !== previous) {
      await setOrderBoldReference(order.id, session.reference);
    }

    return Response.json({
      ok: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      session,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos reabrir el pago.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
