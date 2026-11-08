import type { PricingKey } from "@/commerce/pricing";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { fetchFreshPricing, savePricing } from "@/server/pricing";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "inventory");
    const pricing = await fetchFreshPricing();
    return Response.json({ ok: true, pricing });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const staff = await requirePermission(request, "inventory");
    const body = (await request.json()) as Partial<Record<PricingKey, unknown>>;
    const pricing = await savePricing(
      { aero: body.aero, titan: body.titan, case: body.case },
      staff.uid,
    );
    return Response.json({ ok: true, pricing });
  } catch (error) {
    return jsonError(error);
  }
}
