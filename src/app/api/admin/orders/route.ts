import type {
  AttributionSnapshot,
  CartLine,
  CustomerSnapshot,
  OrderChannel,
  PaymentMethod,
  ShippingSnapshot,
} from "@/commerce/types";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { createManualOrder, listOrders } from "@/server/orders";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "sales");
    const orders = await listOrders(120);
    return Response.json({ ok: true, orders });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requirePermission(request, "sales_manual");
    const body = (await request.json()) as {
      items?: CartLine[];
      customer?: CustomerSnapshot;
      shipping?: ShippingSnapshot;
      paymentMethod?: Exclude<PaymentMethod, "wompi">;
      notes?: string;
      skipStock?: boolean;
      channel?: Exclude<OrderChannel, "online">;
      conversationId?: string;
      attribution?: AttributionSnapshot;
    };
    if (!body.items?.length) {
      return Response.json({ ok: false, error: "Añade al menos un anillo." }, { status: 400 });
    }
    if (!body.paymentMethod) {
      return Response.json({ ok: false, error: "Elige el medio de pago." }, { status: 400 });
    }
    const order = await createManualOrder({
      items: body.items,
      customer: body.customer ?? {
        firstName: "Cliente",
        lastName: "",
        email: "",
        phone: "",
      },
      shipping: body.shipping ?? {
        departamento: "",
        ciudad: "Atelier",
        direccion: "Venta en punto",
        envioCop: 0,
        fuente: "estatico",
      },
      paymentMethod: body.paymentMethod,
      notes: body.notes,
      createdBy: staff.uid,
      skipStock: body.skipStock,
      channel: body.channel,
      conversationId: body.conversationId,
      attribution: body.attribution,
    });
    return Response.json({ ok: true, order });
  } catch (error) {
    return jsonError(error);
  }
}
