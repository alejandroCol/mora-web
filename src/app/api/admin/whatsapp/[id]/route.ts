import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadCrmSettings, patchConversation } from "@/server/crm";
import {
  getConversation,
  listMessages,
  sendWhatsAppTemplate,
  sendWhatsAppText,
} from "@/server/whatsapp";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(request, "whatsapp");
    const { id } = await context.params;
    const conversation = await getConversation(id);
    if (!conversation) {
      return Response.json({ ok: false, error: "Conversación no encontrada." }, { status: 404 });
    }
    const messages = await listMessages(id, 120);
    return Response.json({ ok: true, conversation, messages });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requirePermission(request, "whatsapp");
    const { id } = await context.params;
    const body = (await request.json()) as {
      text?: string;
      templateId?: string;
      templateName?: string;
      language?: string;
      params?: string[];
    };
    const conversation = await getConversation(id);
    if (!conversation) {
      return Response.json({ ok: false, error: "Conversación no encontrada." }, { status: 404 });
    }

    const settings = await loadCrmSettings();
    const actor = { by: staff.uid, byName: staff.name || staff.email, claim: settings.autoClaimOnReply };

    if (body.templateId || body.templateName) {
      const template = settings.templates.find((item) => item.id === body.templateId);
      const name = template?.name || body.templateName?.trim();
      if (!name) {
        return Response.json({ ok: false, error: "Elige una plantilla." }, { status: 400 });
      }
      const message = await sendWhatsAppTemplate({
        phone: conversation.phone,
        name,
        language: template?.language || body.language || "es",
        params: body.params,
        billingCategory: template?.billingCategory ?? "marketing",
        ...actor,
      });
      return Response.json({ ok: true, message });
    }

    if (!body.text?.trim()) {
      return Response.json({ ok: false, error: "Escribe un mensaje." }, { status: 400 });
    }
    const message = await sendWhatsAppText({
      phone: conversation.phone,
      text: body.text.trim(),
      ...actor,
    });
    return Response.json({ ok: true, message });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requirePermission(request, "whatsapp");
    const { id } = await context.params;
    const body = (await request.json()) as Parameters<typeof patchConversation>[1];
    const conversation = await patchConversation(id, body, {
      uid: staff.uid,
      name: staff.name || staff.email,
    });
    return Response.json({ ok: true, conversation });
  } catch (error) {
    return jsonError(error);
  }
}
