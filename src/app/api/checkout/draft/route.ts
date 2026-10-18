import { upsertAbandonedCart } from "@/server/abandonedCarts";
import type { CartLine, CustomerSnapshot, ShippingSnapshot } from "@/commerce/types";

type Body = {
  sessionId?: string;
  items?: CartLine[];
  customer?: Partial<CustomerSnapshot>;
  shipping?: Partial<ShippingSnapshot>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const cart = await upsertAbandonedCart({
      sessionId: body.sessionId ?? "",
      items: body.items ?? [],
      customer: body.customer,
      shipping: body.shipping,
    });
    if (!cart) {
      return Response.json({ ok: true, saved: false });
    }
    return Response.json({
      ok: true,
      saved: true,
      offer: cart.offer
        ? {
            code: cart.offer.code,
            kind: cart.offer.kind,
            value: cart.offer.value,
            discountCop: cart.offer.discountCop,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar el carrito.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
