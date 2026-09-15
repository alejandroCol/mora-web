import { getOrderByNumber, publicOrderView } from "@/server/orders";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const n = (url.searchParams.get("n") ?? url.searchParams.get("ref") ?? "").trim();
  if (!n) {
    return Response.json({ ok: false, error: "Ingresa tu número de pedido." }, { status: 400 });
  }
  const order = await getOrderByNumber(n);
  if (!order) {
    return Response.json(
      { ok: false, error: "No encontramos ese pedido." },
      { status: 404 },
    );
  }
  return Response.json({ ok: true, order: publicOrderView(order) });
}
