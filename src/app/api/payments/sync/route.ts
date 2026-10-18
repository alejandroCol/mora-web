import { PaymentAmountMismatch, publicIntentView, syncBoldReference } from "@/payments";
import { getOrderByNumber, publicOrderView } from "@/server/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      reference?: string;
      orderId?: string;
    };
    const reference = (body.reference ?? body.orderId ?? "").trim();
    if (!reference) {
      return Response.json({ ok: false, error: "Falta la referencia." }, { status: 400 });
    }

    const { voucher, applied } = await syncBoldReference(reference);
    const orderNumber = applied?.intent.metadata.orderNumber;
    const order = orderNumber ? await getOrderByNumber(orderNumber) : null;

    return Response.json({
      ok: true,
      voucher: {
        reference: voucher.reference_id ?? reference,
        status: voucher.payment_status,
        transactionId: voucher.transaction_id,
        paymentType: voucher.payment_method,
      },
      intent: applied ? publicIntentView(applied.intent) : null,
      order: order ? publicOrderView(order) : null,
    });
  } catch (error) {
    if (error instanceof PaymentAmountMismatch) {
      return Response.json({ ok: false, error: "El monto no coincide." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "No pudimos confirmar el pago.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
