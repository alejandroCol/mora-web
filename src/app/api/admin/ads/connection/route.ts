import { jsonError, requirePermission } from "@/server/adminAuth";
import { connectMetaAds, disconnectMetaAds, loadAdsConnection } from "@/server/metaAds/connection";

/** Conecta la cuenta publicitaria. Sin `accountId` y con varias cuentas, devuelve la lista. */
export async function POST(request: Request) {
  try {
    await requirePermission(request, "growth");
    const body = (await request.json()) as { token?: string; accountId?: string };
    const result = await connectMetaAds({
      token: typeof body.token === "string" ? body.token : "",
      accountId: typeof body.accountId === "string" ? body.accountId : "",
    });
    return Response.json({ ok: true, ...result, connection: await loadAdsConnection() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePermission(request, "growth");
    await disconnectMetaAds();
    return Response.json({ ok: true, connection: await loadAdsConnection() });
  } catch (error) {
    return jsonError(error);
  }
}
