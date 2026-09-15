import { fulfillWompiPayment } from "@/server/orders";
import { verifyEventChecksum } from "@/server/wompi";

type WompiEvent = {
  event?: string;
  data?: {
    transaction?: {
      id: string;
      amount_in_cents: number;
      reference: string;
      payment_method_type?: string;
      status: string;
    };
  };
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as WompiEvent;
  const headerChecksum = request.headers.get("x-event-checksum");
  const event = {
    ...payload,
    signature: {
      properties: payload.signature?.properties,
      checksum: payload.signature?.checksum ?? headerChecksum ?? undefined,
    },
  };

  if (!verifyEventChecksum({ data: (payload.data ?? {}) as Record<string, unknown>, signature: event.signature, timestamp: payload.timestamp })) {
    return Response.json({ ok: false }, { status: 401 });
  }

  if (payload.event !== "transaction.updated" || !payload.data?.transaction) {
    return Response.json({ ok: true });
  }

  const tx = payload.data.transaction;
  await fulfillWompiPayment({
    reference: tx.reference,
    transactionId: tx.id,
    amountInCents: tx.amount_in_cents,
    paymentType: tx.payment_method_type,
    status: tx.status,
  });

  return Response.json({ ok: true });
}
