import { jsonError, requirePermission } from "@/server/adminAuth";
import { fetchWhatsAppMedia } from "@/server/whatsapp";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(request, "whatsapp");
    const { id } = await context.params;
    if (!id || id.length > 128) {
      return Response.json({ ok: false, error: "Archivo inválido." }, { status: 400 });
    }
    const media = await fetchWhatsAppMedia(id);
    return new Response(media.body, {
      headers: {
        "Content-Type": media.contentType,
        ...(media.contentLength ? { "Content-Length": media.contentLength } : {}),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
