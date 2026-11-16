import { jsonError, requirePermission } from "@/server/adminAuth";
import { storeVideoPart } from "@/server/crmVideo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Una parte de un video de respuesta rápida. Se manda en crudo: `?id=…&part=0`. */
export async function PUT(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const params = new URL(request.url).searchParams;
    const bytes = Buffer.from(await request.arrayBuffer());
    await storeVideoPart(params.get("id") ?? "", Number(params.get("part")), bytes);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
