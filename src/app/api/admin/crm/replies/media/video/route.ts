import { jsonError, requirePermission } from "@/server/adminAuth";
import { storeReplyMedia } from "@/server/crmReplyMedia";
import { finishVideoUpload } from "@/server/crmVideo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Cierra la subida por partes: convierte a MP4 para WhatsApp y lo guarda como adjunto. */
export async function POST(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const body = (await request.json().catch(() => ({}))) as { id?: string; parts?: number; name?: string };
    const bytes = await finishVideoUpload(String(body.id ?? ""), Number(body.parts));
    const base = String(body.name ?? "video").replace(/\.[^.]+$/, "").slice(0, 100) || "video";
    const media = await storeReplyMedia({ bytes, mimeType: "video/mp4", name: `${base}.mp4` });
    return Response.json({ ok: true, media });
  } catch (error) {
    return jsonError(error);
  }
}
