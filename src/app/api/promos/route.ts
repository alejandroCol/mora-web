import { publicPromos } from "@/server/promos";

export const dynamic = "force-dynamic";

/** Black Friday / Hora Loca abiertas y la hora del servidor. La tienda lo consulta cada minuto. */
export async function GET() {
  const promos = await publicPromos();
  return Response.json({ ok: true, promos }, { headers: { "Cache-Control": "no-store" } });
}
