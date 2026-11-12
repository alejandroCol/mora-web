import type { InstagramAutomationInput } from "@/instagram/types";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { createAutomation, listAutomations } from "@/server/instagram/automations";

export async function POST(request: Request) {
  try {
    const staff = await requirePermission(request, "growth");
    const body = (await request.json()) as Partial<InstagramAutomationInput>;
    const id = await createAutomation(body, staff.uid);
    return Response.json({ ok: true, id, automations: await listAutomations() });
  } catch (error) {
    return jsonError(error);
  }
}
