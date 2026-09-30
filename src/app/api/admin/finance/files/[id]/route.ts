import { jsonError, requirePermission } from "@/server/adminAuth";
import { deleteAttachment, financeSnapshot, readAttachment } from "@/server/finance";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "budget");
    const { id } = await ctx.params;
    const file = await readAttachment(id);
    if (file.buffer) {
      return new Response(new Uint8Array(file.buffer), {
        headers: {
          "Content-Type": file.meta.mime,
          "Content-Disposition": `inline; filename="${file.meta.name.replace(/"/g, "")}"`,
          "Cache-Control": "private, max-age=0",
        },
      });
    }
    if (file.data) {
      const match = file.data.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return Response.json({ ok: false, error: "Archivo ilegible." }, { status: 404 });
      }
      return new Response(Uint8Array.from(Buffer.from(match[2], "base64")), {
        headers: {
          "Content-Type": match[1],
          "Content-Disposition": `inline; filename="${file.meta.name.replace(/"/g, "")}"`,
          "Cache-Control": "private, max-age=0",
        },
      });
    }
    return Response.json({ ok: false, error: "Archivo no encontrado." }, { status: 404 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    await requirePermission(request, "budget");
    const { id } = await ctx.params;
    await deleteAttachment(id);
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}
