import { fulfillWompiPayment, getOrder, publicOrderView } from "@/server/orders";
import { fetchWompiTransaction } from "@/server/wompi";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      transactionId?: string;
      orderId?: string;
    };
    if (!body.transactionId) {
      return Response.json(
        { ok: false, error: "Falta la transacción." },
        { status: 400 },
      );
    }

    const tx = await fetchWompiTransaction(body.transactionId);
    const order = await fulfillWompiPayment({
      reference: tx.reference,
      transactionId: tx.id,
      amountInCents: tx.amount_in_cents,
      paymentType: tx.payment_method_type,
      status: tx.status,
    });

    if (!order) {
      const fallback = body.orderId ? await getOrder(body.orderId) : null;
      if (!fallback) {
        return Response.json(
          { ok: false, error: "Pedido no encontrado." },
          { status: 404 },
        );
      }
      return Response.json({ ok: true, order: publicOrderView(fallback) });
    }

    return Response.json({ ok: true, order: publicOrderView(order) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos confirmar el pago.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
