import { jsonError, requirePermission } from "@/server/adminAuth";
import { isReplyMediaPath, readReplyMedia } from "@/server/crmReplyMedia";
import { readCrmMedia } from "@/server/instagram/media";

/** Archivo guardado en nuestro Storage: adjuntos de Instagram o de respuestas rápidas. */
export async function GET(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const path = new URL(request.url).searchParams.get("path") ?? "";
    const media = isReplyMediaPath(path) ? await readReplyMedia(path) : await readCrmMedia(path);
    return new Response(new Uint8Array(media.buffer), {
      headers: {
        "Content-Type": media.mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
