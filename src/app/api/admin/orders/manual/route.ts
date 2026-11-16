import type { CartLine } from "@/commerce/types";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { manualSaleContext, manualSaleQuote } from "@/server/manualSale";

export const dynamic = "force-dynamic";

/** Stock libre y medios disponibles para armar una venta manual. */
export async function GET(request: Request) {
  try {
    await requirePermission(request, "sales_manual");
    return Response.json({ ok: true, context: await manualSaleContext() });
  } catch (error) {
    return jsonError(error);
  }
}

/** Cotiza el envío de lo que hay en la venta. */
export async function POST(request: Request) {
  try {
    await requirePermission(request, "sales_manual");
    const body = (await request.json()) as {
      items?: CartLine[];
      departamento?: string;
      ciudad?: string;
      direccion?: string;
    };
    return Response.json({ ok: true, quote: await manualSaleQuote(body) });
  } catch (error) {
    return jsonError(error);
  }
}
