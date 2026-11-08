import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadCrmSettings } from "@/server/crm";
import {
  getConversation,
  sendWhatsAppImage,
  WHATSAPP_IMAGE_MAX_BYTES,
  WHATSAPP_IMAGE_MIME,
} from "@/server/whatsapp";

export const dynamic = "force-dynamic";

/** Envía una imagen (JPG/PNG ≤ 5 MB) con pie opcional al chat. Body: multipart `file`, `caption`. */
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
      return Response.json({ ok: false, error: "Adjunta una imagen." }, { status: 400 });
    }
    if (!(WHATSAPP_IMAGE_MIME as readonly string[]).includes(file.type)) {
      return Response.json({ ok: false, error: "Solo JPG o PNG." }, { status: 400 });
    }
    if (file.size > WHATSAPP_IMAGE_MAX_BYTES) {
      return Response.json({ ok: false, error: "La imagen pesa más de 5 MB." }, { status: 400 });
    }
    const caption = String(form.get("caption") ?? "").trim().slice(0, 1024);

    const settings = await loadCrmSettings();
    const message = await sendWhatsAppImage({
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
