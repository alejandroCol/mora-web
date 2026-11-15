import { outboundFileError } from "@/crm/media";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadCrmSettings } from "@/server/crm";
import { deleteReplyMedia, isReplyMediaPath, storeReplyMedia } from "@/server/crmReplyMedia";

export const dynamic = "force-dynamic";

/** Sube la foto o el video de una respuesta rápida. Queda ligado al guardar Ajustes. */
export async function POST(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ ok: false, error: "Adjunta una foto o un video." }, { status: 400 });
    }
    const problem = outboundFileError(file.type, file.size);
    if (problem) return Response.json({ ok: false, error: problem }, { status: 400 });
    const media = await storeReplyMedia({
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      name: file.name,
    });
    return Response.json({ ok: true, media });
  } catch (error) {
    return jsonError(error);
  }
}

/** Descarta un adjunto subido que no se llegó a guardar. Los guardados se borran al guardar Ajustes. */
export async function DELETE(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const path = new URL(request.url).searchParams.get("path") ?? "";
    if (!isReplyMediaPath(path)) return Response.json({ ok: false, error: "Archivo inválido." }, { status: 400 });
    const settings = await loadCrmSettings();
    if (!settings.replies.some((item) => item.media?.path === path)) await deleteReplyMedia(path);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
