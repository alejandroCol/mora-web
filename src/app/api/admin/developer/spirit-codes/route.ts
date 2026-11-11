import { jsonError, requirePermission } from "@/server/adminAuth";
import { createSpiritCode, listSpiritCodes } from "@/server/developer";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "developer");
    return Response.json({ ok: true, codes: await listSpiritCodes() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requirePermission(request, "developer");
    const body = (await request.json()) as {
      code?: unknown;
      lineage?: unknown;
      maxUses?: unknown;
      expiresAt?: unknown;
      note?: unknown;
    };
    const code = await createSpiritCode({
      code: body.code,
      lineage: body.lineage,
      maxUses: body.maxUses,
      expiresAt: body.expiresAt,
      note: body.note,
      createdBy: staff.uid,
    });
    return Response.json({ ok: true, code, codes: await listSpiritCodes() });
  } catch (error) {
    return jsonError(error);
  }
}
