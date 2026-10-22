import type { PaymentPolicy } from "@/commerce/payments";
import type { SalesPolicy } from "@/commerce/sales";
import { jsonError, requirePrivileged } from "@/server/adminAuth";
import { fetchFreshPaymentPolicy, savePaymentPolicy } from "@/server/paymentsPolicy";
import { fetchFreshSalesPolicy, saveSalesPolicy } from "@/server/salesPolicy";

export async function GET(request: Request) {
  try {
    await requirePrivileged(request);
    const sales = await fetchFreshSalesPolicy();
    let payments = await fetchFreshPaymentPolicy();
    if (payments.updatedAt === 0) {
      payments = await savePaymentPolicy({ live: true });
    }
    return Response.json({ ok: true, sales, payments });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requirePrivileged(request);
    const body = (await request.json()) as {
      sales?: { mode?: unknown; saleOn?: unknown };
      payments?: { live?: unknown };
    };
    let sales: SalesPolicy | undefined;
    let payments: PaymentPolicy | undefined;
    if (body.sales) sales = await saveSalesPolicy(body.sales);
    if (body.payments) payments = await savePaymentPolicy(body.payments);
    if (!sales) sales = await fetchFreshSalesPolicy();
    if (!payments) payments = await fetchFreshPaymentPolicy();
    return Response.json({ ok: true, sales, payments });
  } catch (error) {
    return jsonError(error);
  }
}
