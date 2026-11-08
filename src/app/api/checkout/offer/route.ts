import { discountOf } from "@/commerce/cartMath";
import { resolveCheckoutDiscount } from "@/server/discountCodes";

export const dynamic = "force-dynamic";

/**
 * Resuelve el código del checkout: de descuento (Operación › Descuentos) o de carrito
 * recuperado. `subtotal` es solo para mostrar el ahorro; el pedido lo recalcula el servidor.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const sessionId = url.searchParams.get("session") ?? "";
  const email = url.searchParams.get("email") ?? "";
  const subtotal = Math.max(0, Number(url.searchParams.get("subtotal") ?? 0) || 0);
  try {
    const discount = await resolveCheckoutDiscount({ code, sessionId, email });
    if (!discount.source) {
      return Response.json({ ok: true, offer: null, reason: discount.reason ?? null });
    }
    const offer = { kind: discount.kind, value: discount.value };
    return Response.json({
      ok: true,
      offer: {
        code: discount.code,
        kind: discount.kind,
        value: discount.value,
        source: discount.source,
        discountCop: discountOf(subtotal, offer),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oferta no válida.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
