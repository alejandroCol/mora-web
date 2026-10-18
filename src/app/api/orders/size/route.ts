import { products } from "@/lib/catalog";
import { confirmOrderSizes, publicOrderView } from "@/server/orders";

type Body = {
  orderNumber?: string;
  sizes?: { index: number; size: number }[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const orderNumber = body.orderNumber?.trim().toUpperCase() ?? "";
    if (!orderNumber) {
      return Response.json(
        { ok: false, error: "Ingresa tu número de pedido." },
        { status: 400 },
      );
    }
    const sizes = (body.sizes ?? []).filter(
      (entry) => Number.isInteger(entry.index) && Number.isInteger(entry.size),
    );
    if (sizes.length === 0) {
      return Response.json({ ok: false, error: "Elige una talla." }, { status: 400 });
    }
    for (const entry of sizes) {
      const known = Object.values(products).some((product) =>
        product.sizes.includes(entry.size),
      );
      if (!known) {
        return Response.json(
          { ok: false, error: "Hay una talla inválida." },
          { status: 400 },
        );
      }
    }
    const order = await confirmOrderSizes({ orderNumber, sizes });
    return Response.json({ ok: true, order: publicOrderView(order) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No pudimos guardar la talla.";
    const status = message.includes("encontr") ? 404 : 400;
    return Response.json({ ok: false, error: message }, { status });
  }
}
