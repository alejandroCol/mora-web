import { jsonError, requirePermission } from "@/server/adminAuth";
import { readCreatorShot } from "@/server/creadores";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; index: string }> },
) {
  try {
    await requirePermission(request, "growth");
    const { id, index } = await context.params;
    const file = await readCreatorShot(id, Number(index));
    if (!file) {
      return Response.json({ ok: false, error: "Imagen no encontrada." }, { status: 404 });
    }
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
