import { discountOf } from "@/commerce/cartMath";
import { resolveCheckoutOffer } from "@/server/abandonedCarts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const sessionId = url.searchParams.get("session") ?? "";
  const email = url.searchParams.get("email") ?? "";
  try {
    const cart = await resolveCheckoutOffer({ code, sessionId, email });
    if (!cart?.offer) {
      return Response.json({ ok: true, offer: null });
    }
    return Response.json({
      ok: true,
      offer: {
        code: cart.offer.code,
        kind: cart.offer.kind,
        value: cart.offer.value,
        discountCop: discountOf(cart.subtotal, cart.offer),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oferta no válida.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
