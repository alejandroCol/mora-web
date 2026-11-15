import { channelOf } from "@/crm/channel";
import { WHATSAPP_CAPTION_MAX } from "@/crm/media";
import type { WhatsAppMessage } from "@/growth/types";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadCrmSettings } from "@/server/crm";
import { readReplyMedia, whatsappIdForReply } from "@/server/crmReplyMedia";
import { sendInstagramImage, sendInstagramText } from "@/server/instagram/inbox";
import { getConversation, sendWhatsAppMedia, sendWhatsAppText } from "@/server/whatsapp";

export const dynamic = "force-dynamic";

/**
 * Envía una respuesta rápida con su foto o video. Body: `{ replyId, text }`.
 * `text` es el borrador ya editado por el vendedor: va como pie si cabe, si no, aparte.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requirePermission(request, "whatsapp");
    const { id } = await context.params;
    const body = (await request.json()) as { replyId?: string; text?: string };
    const conversation = await getConversation(id);
    if (!conversation) {
      return Response.json({ ok: false, error: "Conversación no encontrada." }, { status: 404 });
    }
    const settings = await loadCrmSettings();
    const reply = settings.replies.find((item) => item.id === body.replyId);
    if (!reply?.media) {
      return Response.json({ ok: false, error: "Esa respuesta ya no tiene adjunto." }, { status: 404 });
    }
    const actor = { by: staff.uid, byName: staff.name || staff.email, claim: settings.autoClaimOnReply };
    const text = String(body.text ?? "").trim();
    const sent: WhatsAppMessage[] = [];

    if (channelOf(conversation) === "instagram") {
      if (reply.media.kind === "video") {
        return Response.json(
          { ok: false, error: "Instagram no recibe videos desde el CRM. Quita el video y envía el texto." },
          { status: 400 },
        );
      }
      const file = await readReplyMedia(reply.media.path);
      sent.push(await sendInstagramImage({ conversation, bytes: file.buffer, mimeType: reply.media.mimeType, ...actor }));
      if (text) sent.push(await sendInstagramText({ conversation, text, ...actor }));
      return Response.json({ ok: true, messages: sent });
    }

    const caption = text.length <= WHATSAPP_CAPTION_MAX ? text : "";
    const media = { phone: conversation.phone, mimeType: reply.media.mimeType, caption, ...actor };
    try {
      sent.push(await sendWhatsAppMedia({ ...media, mediaId: await whatsappIdForReply(reply) }));
    } catch {
      // Meta pudo haber borrado el id antes de tiempo: se sube de nuevo una vez.
      sent.push(await sendWhatsAppMedia({ ...media, mediaId: await whatsappIdForReply(reply, { force: true }) }));
    }
    if (text && !caption) sent.push(await sendWhatsAppText({ phone: conversation.phone, text, ...actor }));
    return Response.json({ ok: true, messages: sent });
  } catch (error) {
    return jsonError(error);
  }
}
