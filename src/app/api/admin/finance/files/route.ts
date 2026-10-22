import { jsonError, requirePermission } from "@/server/adminAuth";
import { financeSnapshot, saveAttachment, saveAttachmentBuffer } from "@/server/finance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "budget");
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const expenseId = String(form.get("expenseId") ?? "").trim();
      if (!(file instanceof File) || file.size < 1) {
        return Response.json({ ok: false, error: "Falta el archivo." }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const saved = await saveAttachmentBuffer({
        name: file.name,
        mime: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : ""),
        buffer,
        expenseId: expenseId || undefined,
        actorUid: actor.uid,
      });
      return Response.json({ ok: true, file: saved, ...(await financeSnapshot()) });
    }

    const body = (await request.json()) as {
      name?: string;
      mime?: string;
      data?: string;
      expenseId?: string;
    };
    if (!body.data || !body.name?.trim()) {
      return Response.json({ ok: false, error: "Archivo y nombre." }, { status: 400 });
    }
    const file = await saveAttachment({
      name: body.name,
      mime: body.mime,
      data: body.data,
      expenseId: body.expenseId,
      actorUid: actor.uid,
    });
    return Response.json({ ok: true, file, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}
