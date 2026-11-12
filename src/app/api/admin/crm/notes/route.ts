import { jsonError, requirePermission } from "@/server/adminAuth";
import { addCrmNote, crmConversationId, listCrmNotes } from "@/server/crm";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const phone = new URL(request.url).searchParams.get("phone") ?? "";
    if (!phone) {
      return Response.json({ ok: false, error: "Falta el teléfono." }, { status: 400 });
    }
    const notes = await listCrmNotes(crmConversationId(phone));
    return Response.json({ ok: true, notes });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requirePermission(request, "whatsapp");
    const body = (await request.json()) as { phone?: string; text?: string };
    if (!body.phone || !body.text?.trim()) {
      return Response.json({ ok: false, error: "Escribe una nota." }, { status: 400 });
    }
    const note = await addCrmNote({
      phone: crmConversationId(body.phone),
      text: body.text,
      by: staff.uid,
      byName: staff.name || staff.email,
    });
    return Response.json({ ok: true, note });
  } catch (error) {
    return jsonError(error);
  }
}
