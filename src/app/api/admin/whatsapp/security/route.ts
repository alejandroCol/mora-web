import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadWhatsAppSecurity, setWhatsAppTwoStepPin } from "@/server/whatsapp";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const security = await loadWhatsAppSecurity();
    return Response.json({ ok: true, ...security });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const body = (await request.json()) as { pin?: string };
    await setWhatsAppTwoStepPin(body.pin ?? "");
    const security = await loadWhatsAppSecurity();
    return Response.json({ ok: true, ...security });
  } catch (error) {
    return jsonError(error);
  }
}
