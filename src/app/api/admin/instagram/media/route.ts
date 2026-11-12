import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadGrowthSettings } from "@/server/growthSettings";
import { connectionOf, listInstagramMedia } from "@/server/instagram/graph";

/** Publicaciones recientes de la cuenta, para elegir en cuáles aplica una regla. */
export async function GET(request: Request) {
  try {
    await requirePermission(request, "growth");
    const media = await listInstagramMedia(connectionOf(await loadGrowthSettings()));
    return Response.json({ ok: true, media });
  } catch (error) {
    return jsonError(error);
  }
}
