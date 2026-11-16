import type { ManualSaleRequest } from "@/commerce/manualSale";
import { requestOrigin } from "@/payments";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { createManualSale } from "@/server/manualSale";
import { listOrders } from "@/server/orders";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "sales");
    const orders = await listOrders(120);
    return Response.json({ ok: true, orders });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requirePermission(request, "sales_manual");
    const body = (await request.json()) as ManualSaleRequest;
    const result = await createManualSale(body, staff, requestOrigin(request));
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
