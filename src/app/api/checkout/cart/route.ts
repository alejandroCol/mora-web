import { resumableCartItems } from "@/server/abandonedCarts";

export const dynamic = "force-dynamic";

/** Productos de un carrito guardado, para el enlace «Retomar mi pedido». Sin datos de la persona. */
export async function GET(request: Request) {
  const session = new URL(request.url).searchParams.get("session") ?? "";
  const items = await resumableCartItems(session).catch(() => null);
  if (!items?.length) return Response.json({ ok: false }, { status: 404 });
  return Response.json({ ok: true, items });
}
