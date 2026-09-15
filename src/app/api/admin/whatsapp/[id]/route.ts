import { jsonError, requirePermission } from "@/server/adminAuth";
import {
  getConversation,
  listMessages,
  sendWhatsAppText,
  updateConversation,
} from "@/server/whatsapp";
import type { WhatsAppConversationStatus } from "@/growth/types";

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
    const messages = await listMessages(id);
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
    await requirePermission(request, "whatsapp");
    const { id } = await context.params;
    const body = (await request.json()) as { text?: string };
    if (!body.text?.trim()) {
      return Response.json({ ok: false, error: "Escribe un mensaje." }, { status: 400 });
    }
    const conversation = await getConversation(id);
    if (!conversation) {
      return Response.json({ ok: false, error: "Conversación no encontrada." }, { status: 404 });
    }
    const message = await sendWhatsAppText({
      phone: conversation.phone,
      text: body.text.trim(),
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
    await requirePermission(request, "whatsapp");
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: WhatsAppConversationStatus;
      unread?: number;
    };
    const conversation = await updateConversation(id, body);
    return Response.json({ ok: true, conversation });
  } catch (error) {
    return jsonError(error);
  }
}
