import { readOutboundImage } from "@/server/instagram/media";

/**
 * Imagen que el equipo envía por Instagram desde el CRM. Meta la descarga de
 * aquí, por eso es pública; el id es aleatorio y no se puede adivinar.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const file = await readOutboundImage(id);
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return Response.json({ ok: false, error: "Archivo no encontrado." }, { status: 404 });
  }
}
