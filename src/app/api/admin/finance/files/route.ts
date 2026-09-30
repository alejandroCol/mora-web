import { jsonError, requirePermission } from "@/server/adminAuth";
import { financeSnapshot, saveAttachment } from "@/server/finance";

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "budget");
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
