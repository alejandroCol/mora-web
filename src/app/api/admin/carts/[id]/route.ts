import type { CartOfferKind } from "@/commerce/types";
import { jsonError, requirePermission } from "@/server/adminAuth";
import {
  dismissAbandonedCart,
  offerAbandonedDiscount,
  remindAbandonedCart,
} from "@/server/abandonedCarts";
import { abandonedCheckoutUrl, abandonedResumeUrl } from "@/server/email";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const staff = await requirePermission(request, "sales");
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      action?: "offer" | "dismiss" | "remind";
      kind?: CartOfferKind;
      value?: number;
    };

    if (body.action === "dismiss") {
      const cart = await dismissAbandonedCart(id);
      return Response.json({ ok: true, cart });
    }

    if (body.action === "remind") {
      const cart = await remindAbandonedCart(id, staff.uid);
      return Response.json({ ok: true, cart, emailed: true, checkoutUrl: abandonedResumeUrl(cart.sessionId) });
    }

    if (body.action !== "offer" || !body.kind || body.value == null) {
      return Response.json({ ok: false, error: "Indica el descuento." }, { status: 400 });
    }

    const { cart, emailed } = await offerAbandonedDiscount({
      sessionId: id,
      kind: body.kind,
      value: body.value,
      offeredBy: staff.uid,
    });
    return Response.json({
      ok: true,
      cart,
      emailed,
      checkoutUrl: cart.offer ? abandonedCheckoutUrl(cart.offer.code, cart.sessionId) : undefined,
    });
  } catch (error) {
    return jsonError(error);
  }
}
