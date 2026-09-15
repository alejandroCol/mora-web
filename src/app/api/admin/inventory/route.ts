import { jsonError, requirePermission } from "@/server/adminAuth";
import { listInventory, setInventoryUnits } from "@/server/inventory";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "inventory");
    const inventory = await listInventory();
    return Response.json({ ok: true, inventory });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requirePermission(request, "inventory");
    const body = (await request.json()) as { sku?: string; units?: number };
    if (!body.sku || typeof body.units !== "number") {
      return Response.json({ ok: false, error: "SKU y unidades." }, { status: 400 });
    }
    await setInventoryUnits(body.sku, body.units);
    const inventory = await listInventory();
    return Response.json({ ok: true, inventory });
  } catch (error) {
    return jsonError(error);
  }
}
