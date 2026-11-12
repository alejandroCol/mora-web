import type { InstagramAutomationInput } from "@/instagram/types";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { deleteAutomation, listAutomations, updateAutomation } from "@/server/instagram/automations";

/** Edita la regla. Para pausar o activar basta mandar `{ active }`. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(request, "growth");
    const { id } = await context.params;
    const body = (await request.json()) as Partial<InstagramAutomationInput>;
    await updateAutomation(id, body);
    return Response.json({ ok: true, automations: await listAutomations() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(request, "growth");
    const { id } = await context.params;
    await deleteAutomation(id);
    return Response.json({ ok: true, automations: await listAutomations() });
  } catch (error) {
    return jsonError(error);
  }
}
