import { parseScarcityCount, type ScarcityNote } from "@/commerce/scarcity";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { readScarcity, setScarcity } from "@/server/scarcity";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "inventory");
    const notes = await readScarcity();
    return Response.json({ ok: true, notes });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requirePermission(request, "inventory");
    const body = (await request.json()) as { sku?: string; on?: unknown; left?: unknown };
    if (!body.sku) {
      return Response.json({ ok: false, error: "Elige color y talla." }, { status: 400 });
    }
    if (body.left === null) {
      await setScarcity(body.sku, null);
    } else {
      const count = parseScarcityCount(body.left);
      if (count == null) {
        return Response.json({ ok: false, error: "Escribe el número del aviso." }, { status: 400 });
      }
      const note: ScarcityNote = { on: body.on === true, count };
      await setScarcity(body.sku, note);
    }
    const notes = await readScarcity();
    return Response.json({ ok: true, notes });
  } catch (error) {
    return jsonError(error);
  }
}
