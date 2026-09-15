import { jsonError, requirePermission } from "@/server/adminAuth";
import { loadCommerceSettings, saveCommerceSettings } from "@/server/quoteShipping";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "shipping");
    const settings = await loadCommerceSettings();
    return Response.json({ ok: true, settings });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requirePermission(request, "shipping");
    const body = await request.json();
    const settings = await saveCommerceSettings(body);
    return Response.json({ ok: true, settings });
  } catch (error) {
    return jsonError(error);
  }
}
