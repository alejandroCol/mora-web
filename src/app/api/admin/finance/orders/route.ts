import type { FinancePurchaseOrder } from "@/commerce/finance";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { createOrder, financeSnapshot } from "@/server/finance";

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "budget");
    const body = (await request.json()) as Partial<FinancePurchaseOrder>;
    await createOrder(body, actor.uid);
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}
