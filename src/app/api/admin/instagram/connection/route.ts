import { jsonError, requirePermission } from "@/server/adminAuth";
import {
  connectInstagram,
  disconnectInstagram,
  loadInstagramStatus,
  registerInstagramWebhook,
  setInstagramHumanAgent,
} from "@/server/instagram/connection";

/** Conecta la cuenta con el token del usuario del sistema. */
export async function POST(request: Request) {
  try {
    await requirePermission(request, "growth");
    const body = (await request.json()) as { token?: string };
    const { warning } = await connectInstagram(String(body.token ?? ""));
    return Response.json({ ok: true, warning, status: await loadInstagramStatus() });
  } catch (error) {
    return jsonError(error);
  }
}

/** Registra el webhook de Instagram en la app de Meta (lo que antes se hacía a mano en su panel). */
export async function PUT(request: Request) {
  try {
    await requirePermission(request, "growth");
    await registerInstagramWebhook();
    return Response.json({ ok: true, status: await loadInstagramStatus() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePermission(request, "growth");
    const body = (await request.json()) as { humanAgent?: boolean };
    await setInstagramHumanAgent(body.humanAgent === true);
    return Response.json({ ok: true, status: await loadInstagramStatus() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePermission(request, "growth");
    await disconnectInstagram();
    return Response.json({ ok: true, status: await loadInstagramStatus() });
  } catch (error) {
    return jsonError(error);
  }
}
