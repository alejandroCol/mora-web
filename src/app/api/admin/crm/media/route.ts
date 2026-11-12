import { jsonError, requirePermission } from "@/server/adminAuth";
import { readCrmMedia } from "@/server/instagram/media";

/** Foto, audio o archivo de un chat de Instagram, guardado en nuestro Storage. */
export async function GET(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const path = new URL(request.url).searchParams.get("path") ?? "";
    const media = await readCrmMedia(path);
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
