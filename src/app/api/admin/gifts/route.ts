import type { GiftRequest } from "@/commerce/gifts";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { createGift, giftContext, listGifts } from "@/server/gifts";

export const dynamic = "force-dynamic";

/** Regalos registrados. Con `?context=1` suma el stock libre y los chats para crear uno. */
export async function GET(request: Request) {
  try {
    await requirePermission(request, "sales");
    const wantsContext = new URL(request.url).searchParams.get("context") === "1";
    if (!wantsContext) return Response.json({ ok: true, gifts: await listGifts() });
    await requirePermission(request, "sales_manual");
    return Response.json({ ok: true, context: await giftContext() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requirePermission(request, "sales_manual");
    const body = (await request.json()) as GiftRequest;
    const gift = await createGift(body, { uid: staff.uid, name: staff.name || staff.email });
    return Response.json({ ok: true, gift });
  } catch (error) {
    return jsonError(error);
  }
}
