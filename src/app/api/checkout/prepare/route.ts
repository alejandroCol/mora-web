import { lineToOrderItem, normalizeCartLine } from "@/commerce/sku";
import { isSizePending } from "@/commerce/sizing";
import { cartCount, discountOf, subtotalOf } from "@/commerce/cartMath";
import type {
  AttributionSnapshot,
  CartLine,
  CustomerSnapshot,
  ShippingQuoteOption,
} from "@/commerce/types";
import { products } from "@/lib/catalog";
import { resolveCheckoutOffer } from "@/server/abandonedCarts";
import { upsertLead } from "@/server/leads";
import { requestClient, sendMetaEvent } from "@/server/metaCapi";
import { createPendingOrder } from "@/server/orders";
import { quoteShipping } from "@/server/quoteShipping";
import { boldSessionForOrder } from "@/server/checkoutSession";
import { boldIsConfigured, newBoldReference, requestOrigin } from "@/payments";

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
  sessionId?: string;
  offerCode?: string;
};

export async function POST(request: Request) {
  try {
    if (!boldIsConfigured()) {
      return Response.json(
        { ok: false, error: "El pago aún no está configurado." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as Body;
    const items = (body.items ?? [])
      .filter((item) => item.qty > 0)
      .map(normalizeCartLine);
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
      if (isSizePending(item)) continue;
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
    if (!customer.documentNumber?.replace(/\D/g, "")) {
      return Response.json(
        { ok: false, error: "Cédula o NIT para la factura." },
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

    const offered = await resolveCheckoutOffer({
      sessionId: body.sessionId,
      code: body.offerCode,
      email: customer.email,
    }).catch(() => null);
    const discountCop = offered?.offer
      ? discountOf(subtotalOf(items), offered.offer)
      : 0;

    const boldReference = newBoldReference();
    const order = await createPendingOrder({
      items,
      customer: {
        firstName: customer.firstName.trim(),
        lastName: customer.lastName?.trim() ?? "",
        email: customer.email.trim().toLowerCase(),
        phone: customer.phone.trim(),
        documentType: customer.documentType?.trim() || "CC",
        documentNumber: customer.documentNumber.replace(/\D/g, ""),
      },
      shipping: shippingSnap,
      notes: body.notes,
      boldReference,
      attribution: body.attribution,
      discountCop,
      cartSessionId: body.sessionId || offered?.sessionId,
      offerCode: offered?.offer?.code,
    });

    const origin = requestOrigin(request);
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

    const session = await boldSessionForOrder(order, origin, boldReference);

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
      session,
      items: items.map(lineToOrderItem),
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "No pudimos crear el pago.";
    const message =
      /default credentials|application-default/i.test(raw)
        ? "Firebase no está conectado en este entorno. En local, llena FIREBASE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS y reinicia el servidor."
        : raw;
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export type { ShippingQuoteOption };
