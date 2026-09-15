import { lineToOrderItem } from "@/commerce/sku";
import { cartCount, subtotalOf } from "@/commerce/cartMath";
import type {
  AttributionSnapshot,
  CartLine,
  CustomerSnapshot,
  ShippingQuoteOption,
} from "@/commerce/types";
import { products } from "@/lib/catalog";
import { upsertLead } from "@/server/leads";
import { requestClient, sendMetaEvent } from "@/server/metaCapi";
import { createPendingOrder } from "@/server/orders";
import { quoteShipping } from "@/server/quoteShipping";
import { buildWidgetConfig, wompiIsConfigured } from "@/server/wompi";
import { formatoDepartamentoEtiqueta } from "@/lib/colombiaGeo";

type Body = {
  items?: CartLine[];
  customer?: CustomerSnapshot;
  shipping?: {
    departamento: string;
    ciudad: string;
    direccion: string;
    referencia?: string;
    carrier?: string;
  };
  notes?: string;
  attribution?: AttributionSnapshot;
};

function siteUrl(request: Request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin
  );
}

export async function POST(request: Request) {
  try {
    if (!wompiIsConfigured()) {
      return Response.json(
        { ok: false, error: "Wompi aún no está configurado." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as Body;
    const items = (body.items ?? []).filter((item) => item.qty > 0);
    const customer = body.customer;
    const shipping = body.shipping;

    if (items.length === 0) {
      return Response.json({ ok: false, error: "El carrito está vacío." }, { status: 400 });
    }
    for (const item of items) {
      const product = products[item.modelId];
      if (!product || !product.finishes.includes(item.finishId)) {
        return Response.json({ ok: false, error: "Hay un anillo inválido." }, { status: 400 });
      }
      if (!product.sizes.includes(item.size)) {
        return Response.json({ ok: false, error: "Hay una talla inválida." }, { status: 400 });
      }
    }
    if (
      !customer?.firstName?.trim() ||
      !customer.email?.trim() ||
      !customer.phone?.trim()
    ) {
      return Response.json(
        { ok: false, error: "Nombre, correo y teléfono." },
        { status: 400 },
      );
    }
    if (
      !shipping?.departamento?.trim() ||
      !shipping.ciudad?.trim() ||
      !shipping.direccion?.trim()
    ) {
      return Response.json(
        { ok: false, error: "Completa el destino de envío." },
        { status: 400 },
      );
    }

    const quote = await quoteShipping({
      departamento: shipping.departamento,
      ciudad: shipping.ciudad,
      direccion: shipping.direccion,
      nombre: `${customer.firstName} ${customer.lastName ?? ""}`.trim(),
      telefono: customer.phone,
      subtotal: subtotalOf(items),
      piezas: cartCount(items),
    });

    const selected =
      quote.opciones.find((option) => option.carrier === shipping.carrier) ??
      quote.seleccionada;

    const shippingSnap = {
      departamento: shipping.departamento,
      ciudad: shipping.ciudad,
      direccion: shipping.direccion,
      referencia: shipping.referencia,
      envioCop: selected?.totalPriceCop ?? quote.envioCop,
      fuente: quote.fuente,
      carrier: selected?.carrier,
      carrierLabel: selected?.carrierLabel,
      service: selected?.service,
      deliveryEstimate: selected?.deliveryEstimate,
    };

    const wompiReference = `MORA_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const order = await createPendingOrder({
      items,
      customer: {
        firstName: customer.firstName.trim(),
        lastName: customer.lastName?.trim() ?? "",
        email: customer.email.trim().toLowerCase(),
        phone: customer.phone.trim(),
        documentType: customer.documentType,
        documentNumber: customer.documentNumber,
      },
      shipping: shippingSnap,
      notes: body.notes,
      wompiReference,
      attribution: body.attribution,
    });

    const origin = siteUrl(request);
    const client = requestClient(request);
    await upsertLead({
      source: body.attribution?.fbclid ? "ad" : "checkout",
      name: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
      email: order.customer.email,
      phone: order.customer.phone,
      attribution: body.attribution,
      lastEvent: "InitiateCheckout",
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: "interested",
    }).catch(() => undefined);
    await sendMetaEvent({
      name: "InitiateCheckout",
      eventId: `checkout-${order.id}`,
      sourceUrl: `${origin}/checkout`,
      user: {
        email: order.customer.email,
        phone: order.customer.phone,
        firstName: order.customer.firstName,
        lastName: order.customer.lastName,
        city: order.shipping.ciudad,
        state: order.shipping.departamento,
      },
      attribution: body.attribution,
      data: {
        currency: "COP",
        value: order.totals.total,
        content_ids: items.map((item) => `${item.modelId}-${item.finishId}`),
        content_type: "product",
        num_items: cartCount(items),
      },
      ...client,
    }).catch(() => undefined);

    const expirationTime = new Date(order.expiresAt ?? Date.now() + 45 * 60 * 1000).toISOString();
    const widget = buildWidgetConfig({
      reference: wompiReference,
      amountCop: order.totals.total,
      redirectUrl: `${origin}/pedido/${order.orderNumber}`,
      expirationTime,
      customer: {
        email: order.customer.email,
        fullName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
        phoneNumber: order.customer.phone.replace(/\D/g, "").slice(-10),
        phoneNumberPrefix: "+57",
        legalId: order.customer.documentNumber,
        legalIdType: order.customer.documentType,
      },
      shipping: {
        addressLine1: order.shipping.direccion,
        addressLine2: order.shipping.referencia,
        country: "CO",
        city: order.shipping.ciudad,
        phoneNumber: order.customer.phone.replace(/\D/g, "").slice(-10),
        region: formatoDepartamentoEtiqueta(order.shipping.departamento),
        name: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
      },
    });

    return Response.json({
      ok: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      totals: order.totals,
      quote: {
        ...quote,
        envioCop: shippingSnap.envioCop,
        seleccionada: selected ?? quote.seleccionada,
      } satisfies {
        envioCop: number;
        fuente: string;
        gratis: boolean;
        seleccionada: ShippingQuoteOption | null;
        opciones: ShippingQuoteOption[];
      },
      widget,
      items: items.map(lineToOrderItem),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos crear el pago.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export type { ShippingQuoteOption };
