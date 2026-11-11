import { jsonError, requirePermission } from "@/server/adminAuth";
import { listFeatureFlags, saveFeatureFlag } from "@/server/developer";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "developer");
    return Response.json({ ok: true, flags: await listFeatureFlags() });
  } catch (error) {
    return jsonError(error);
  }
}

/** Crea una clave suelta (aún sin código en las apps). Nace apagada. */
export async function POST(request: Request) {
  try {
    const staff = await requirePermission(request, "developer");
    const body = (await request.json()) as { key?: unknown; note?: unknown };
    const flag = await saveFeatureFlag({
      key: typeof body.key === "string" ? body.key : "",
      stage: "off",
      testers: [],
      note: body.note,
      by: staff.uid,
      create: true,
    });
    return Response.json({ ok: true, flag, flags: await listFeatureFlags() });
  } catch (error) {
    return jsonError(error);
  }
}
