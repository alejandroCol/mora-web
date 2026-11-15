import { channelOf } from "@/crm/channel";
import { outboundFileError, outboundKindOf, WHATSAPP_CAPTION_MAX } from "@/crm/media";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { sendInstagramImage } from "@/server/instagram/inbox";
import { loadCrmSettings } from "@/server/crm";
import { getConversation, sendWhatsAppFile } from "@/server/whatsapp";

export const dynamic = "force-dynamic";

/**
 * Envía una foto (JPG/PNG ≤ 5 MB) o un video (MP4 ≤ 16 MB) con pie opcional. Body: multipart `file`, `caption`.
 * El archivo va directo a Meta: no pasa por nuestro Storage.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requirePermission(request, "whatsapp");
    const { id } = await context.params;
    const conversation = await getConversation(id);
    if (!conversation) {
      return Response.json({ ok: false, error: "Conversación no encontrada." }, { status: 404 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File) || file.size === 0) {
      return Response.json({ ok: false, error: "Adjunta una foto o un video." }, { status: 400 });
    }
    const problem = outboundFileError(file.type, file.size);
    if (problem) return Response.json({ ok: false, error: problem }, { status: 400 });
    const caption = String(form.get("caption") ?? "").trim().slice(0, WHATSAPP_CAPTION_MAX);

    const settings = await loadCrmSettings();
    if (channelOf(conversation) === "instagram") {
      if (outboundKindOf(file.type) === "video") {
        return Response.json({ ok: false, error: "Instagram no recibe videos desde el CRM." }, { status: 400 });
      }
      const message = await sendInstagramImage({
        conversation,
        bytes: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type,
        caption,
        by: staff.uid,
        byName: staff.name || staff.email,
        claim: settings.autoClaimOnReply,
      });
      return Response.json({ ok: true, message });
    }
    const message = await sendWhatsAppFile({
      phone: conversation.phone,
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      fileName: file.name,
      caption,
      by: staff.uid,
      byName: staff.name || staff.email,
      claim: settings.autoClaimOnReply,
    });
    return Response.json({ ok: true, message });
  } catch (error) {
    return jsonError(error);
  }
}
