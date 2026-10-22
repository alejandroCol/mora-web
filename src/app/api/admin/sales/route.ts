import { jsonError, requirePrivileged } from "@/server/adminAuth";
import { fetchFreshSalesPolicy, saveSalesPolicy } from "@/server/salesPolicy";

export async function GET(request: Request) {
  try {
    await requirePrivileged(request);
    const policy = await fetchFreshSalesPolicy();
    return Response.json({ ok: true, policy });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requirePrivileged(request);
    const body = (await request.json()) as { mode?: unknown; saleOn?: unknown };
    const policy = await saveSalesPolicy(body);
    return Response.json({ ok: true, policy });
  } catch (error) {
    return jsonError(error);
  }
}
