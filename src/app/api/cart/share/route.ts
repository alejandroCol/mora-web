import type { CartLine } from "@/commerce/types";
import { createSharedCart } from "@/server/sharedCarts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { items?: CartLine[] };
    const shared = await createSharedCart(body.items ?? []);
    return Response.json({ ok: true, ...shared });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : 500;
    const message = error instanceof Error ? error.message : "No se pudo compartir.";
    return Response.json({ ok: false, error: message }, { status: status || 500 });
  }
}
