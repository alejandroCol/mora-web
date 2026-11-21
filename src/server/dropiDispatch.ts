import type { MoraOrder } from "@/commerce/types";
import {
  createDropiOrder,
  dropiCarrierLabel,
  dropiConfigured,
  dropiRingProductId,
  dropiStatusLabel,
  generateDropiGuide,
  getDropiOrder,
  getDropiProduct,
  quoteDropi,
  resolveDropiCity,
} from "./dropiClient";
import { guideTarget } from "./hekaDispatch";
import { attachShippingGuide, getOrder, transitionOrder } from "./orders";

/** Los anillos salen por Dropi cuando hay token. El medidor sigue por Heka. */
export function orderGuideGoesByDropi(order: MoraOrder) {
  if (!dropiConfigured()) return false;
  try {
    return guideTarget(order).kind === "rings";
  } catch {
    return false;
  }
}

/** La guía del tramo que hoy se consulta (anillos, salvo que el medidor siga en camino) es de Dropi. */
export function orderTrackedByDropi(order: MoraOrder) {
  if (order.status === "sizer_transit") return false;
  return order.shipments?.rings?.guideProvider === "dropi";
}

function requireDropi() {
  if (!dropiConfigured()) throw new Error("Falta el token de Dropi.");
}

function ringPieces(order: MoraOrder) {
  const rings = order.items
    .filter((item) => item.kind !== "case" && item.modelId !== "case")
    .reduce((sum, item) => sum + Math.max(1, Math.round(item.qty)), 0);
  return Math.max(1, rings);
}

function declaredValue(order: MoraOrder) {
  return Math.max(25000, Math.round(order.totals.subtotal));
}

/** Lo que el super admin ve antes de crear la guía: transportadoras y flete de Dropi. */
export async function quoteOrderWithDropi(orderId: string) {
  requireDropi();
  const order = await getOrder(orderId);
  if (!order) throw new Error("Pedido no encontrado.");
  const { kind, destinationDane } = guideTarget(order);
  const options = await quoteDropi({ destinationDane, declaredValue: declaredValue(order) });
  if (!options.length) throw new Error("Dropi no tiene cobertura para esa ciudad.");
  const wanted = (order.shipping.carrier || "").toLowerCase();
  const suggested = options.find((option) => option.carrier === wanted) ?? options[0];
  return {
    kind,
    options,
    suggested: suggested.carrier,
    origin: "",
    sandbox: false,
    provider: "dropi" as const,
  };
}

export async function dispatchOrderWithDropi(
  orderId: string,
  by: string,
  choice: { carrier?: string } = {},
) {
  requireDropi();
  const order = await getOrder(orderId);
  if (!order) throw new Error("Pedido no encontrado.");
  const { kind, phone, destinationDane } = guideTarget(order);
  if (kind !== "rings") throw new Error("El medidor todavía no sale por Dropi.");

  let dropiOrderId = order.shipments?.rings?.dropiOrderId?.trim() ?? "";
  let carrierLabel = order.shipments?.rings?.carrierLabel ?? "";

  // La orden se cobra al crearla: si ya existe, no se crea otra aunque falle la guía.
  if (!dropiOrderId) {
    const options = await quoteDropi({ destinationDane, declaredValue: declaredValue(order) });
    const picked = choice.carrier?.trim().toLowerCase();
    const chosen = picked ? options.find((option) => option.carrier === picked) : options[0];
    if (!chosen) {
      throw new Error(
        picked
          ? "Esa transportadora no cubre este envío. Elige otra."
          : "Dropi no tiene cobertura para esa ciudad.",
      );
    }
    const [place, product] = await Promise.all([
      resolveDropiCity({
        destinationDane,
        departamento: order.shipping.departamento,
        ciudad: order.shipping.ciudad,
      }),
      getDropiProduct(dropiRingProductId()),
    ]);

    const pieces = ringPieces(order);
    const unitPrice = Math.max(1, Math.round(declaredValue(order) / pieces));
    const detail = order.items
      .map((item) => `${item.finishTitle}${item.size ? ` talla ${item.size}` : ""}`)
      .join(", ");
    const email = order.customer.email.trim();
    const referencia = order.shipping.referencia?.trim();

    const created = await createDropiOrder({
      calculate_costs_and_shiping: true,
      state: place.state,
      city: place.city,
      name: order.customer.firstName.trim(),
      surname: order.customer.lastName.trim() || ".",
      dir: [order.shipping.direccion.trim(), referencia].filter(Boolean).join(" · "),
      phone,
      ...(email.includes("@") ? { client_email: email } : {}),
      notes: [order.orderNumber, detail].filter(Boolean).join(" · "),
      text_to_show_order_rotulo: `Anillo Mora · ${order.orderNumber}`,
      payment_method_id: 1,
      rate_type: "SIN RECAUDO",
      type: "FINAL_ORDER",
      status: "PENDIENTE",
      total_order: unitPrice * pieces,
      supplier_id: product.supplierId,
      shop_order_id: order.orderNumber,
      distributionCompany: { id: Number(chosen.service) },
      products: [{ id: product.id, price: unitPrice, quantity: pieces, variation_id: null }],
    });
    dropiOrderId = created.id;
    carrierLabel = chosen.carrierLabel;
    await attachShippingGuide({
      orderId,
      by,
      kind,
      shipping: {
        dropiOrderId,
        guideProvider: "dropi",
        carrier: chosen.carrier,
        carrierLabel: chosen.carrierLabel,
      },
      note: `Orden ${dropiOrderId} creada en Dropi · ${chosen.carrierLabel}${
        created.shippingAmount ? ` · flete ${Math.round(created.shippingAmount)}` : ""
      }`,
    });
  }

  let guided = await generateDropiGuide(dropiOrderId).catch(async (error: unknown) => {
    // Si la orden ya estaba en GUIA_GENERADA, Dropi rechaza el cambio pero la guía existe.
    const current = await getDropiOrder(dropiOrderId).catch(() => null);
    if (current?.guide) return current;
    throw new Error(
      `La orden ${dropiOrderId} ya quedó creada en Dropi, pero la guía no salió: ${
        error instanceof Error ? error.message : "error"
      } Vuelve a pulsar Crear guía; no se cobra otra vez.`,
    );
  });
  if (!guided.guide) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    guided = await getDropiOrder(dropiOrderId);
  }
  if (!guided.guide) {
    throw new Error(
      `La orden ${dropiOrderId} ya quedó creada en Dropi y la guía se está generando. Vuelve a pulsar Crear guía en un momento; no se cobra otra vez.`,
    );
  }

  const carrier = guided.carrier.toLowerCase();
  await attachShippingGuide({
    orderId,
    by,
    kind,
    shipping: {
      trackingNumber: guided.guide,
      hekaGuideId: dropiOrderId,
      hekaStatus: guided.status,
      hekaStatusLabel: dropiStatusLabel(guided.status),
      guideProvider: "dropi",
      dropiOrderId,
      ...(carrier ? { carrier, carrierLabel: dropiCarrierLabel(carrier) } : {}),
    },
    note: `Guía de los anillos ${guided.guide} · ${
      carrier ? dropiCarrierLabel(carrier) : carrierLabel || "Dropi"
    } · Dropi`,
  });

  return (await getOrder(orderId)) ?? order;
}

export async function refreshOrderDropi(orderId: string, by: string) {
  requireDropi();
  const order = await getOrder(orderId);
  if (!order) throw new Error("Pedido no encontrado.");
  const leg = order.shipments?.rings;
  const dropiOrderId = leg?.dropiOrderId?.trim() || leg?.hekaGuideId?.trim() || "";
  if (!dropiOrderId) throw new Error("Este pedido todavía no tiene guía.");

  const current = await getDropiOrder(dropiOrderId);
  const status = current.status || leg?.hekaStatus || "";
  const changed = status !== (leg?.hekaStatus ?? "");
  let next = await attachShippingGuide({
    orderId,
    by,
    kind: "rings",
    shipping: {
      hekaStatus: status,
      hekaStatusLabel: dropiStatusLabel(status),
      ...(current.guide ? { trackingNumber: current.guide } : {}),
    },
    note: changed ? `Dropi · ${dropiStatusLabel(status)}` : undefined,
  });

  if (/^ENTREGAD[OA]$/.test(status.trim().toUpperCase()) && next.status === "in_transit") {
    next = await transitionOrder({
      orderId,
      to: "delivered",
      by,
      note: "Dropi marcó la guía como entregada",
    });
  }
  return next;
}
