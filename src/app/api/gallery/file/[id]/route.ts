import { readGalleryFile } from "@/server/gallery";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id || id.length > 80) {
      return Response.json({ ok: false, error: "Imagen inválida." }, { status: 400 });
    }
    const file = await readGalleryFile(id);
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return Response.json({ ok: false, error: "Imagen no encontrada." }, { status: 404 });
  }
}
