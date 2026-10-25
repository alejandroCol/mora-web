import { jsonError, requirePermission } from "@/server/adminAuth";
import { listCreatorApplications } from "@/server/creadores";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    const creators = await listCreatorApplications();
    return Response.json({ ok: true, creators }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
