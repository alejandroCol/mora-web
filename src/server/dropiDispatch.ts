import type { MoraOrder } from "@/commerce/types";
import {
  createDropiOrder,
  dropiCarrierLabel,
  dropiConfigured,
  dropiRingProductId,
  dropiSizerProductId,
  dropiStatusLabel,
  generateDropiGuide,
  getDropiOrder,
  getDropiProduct,
  quoteDropi,
  resolveDropiCity,
} from "./dropiClient";
import { guideTarget } from "./hekaDispatch";
import { attachShippingGuide, getOrder, notifyGuideReady, transitionOrder } from "./orders";

/** Con token, el medidor y los anillos salen por Dropi; cada tramo con su producto. */
export function orderGuideGoesByDropi(order: MoraOrder) {
  if (!dropiConfigured()) return false;
  try {
    guideTarget(order);
    return true;
  } catch {
    return false;
  }
}

/** Tramo que se consulta: los anillos si ya tienen guía; si no, el medidor mientras va en camino. */
function trackedKind(order: MoraOrder): "sizer" | "rings" {
  if (order.shipments?.rings?.hekaGuideId) return "rings";
  return order.status === "sizer_transit" ? "sizer" : "rings";
}

export function orderTrackedByDropi(order: MoraOrder) {
  return order.shipments?.[trackedKind(order)]?.guideProvider === "dropi";
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

function declaredValue(order: MoraOrder, kind: "sizer" | "rings") {
  return kind === "sizer" ? 25000 : Math.max(25000, Math.round(order.totals.subtotal));
}

/** Lo que el super admin ve antes de crear la guía: transportadoras y flete de Dropi. */
export async function quoteOrderWithDropi(orderId: string) {
  requireDropi();
  const order = await getOrder(orderId);
  if (!order) throw new Error("Pedido no encontrado.");
  const { kind, destinationDane } = guideTarget(order);
  const options = await quoteDropi({ destinationDane, declaredValue: declaredValue(order, kind) });
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
  const isSizer = kind === "sizer";
  const declared = declaredValue(order, kind);

  let dropiOrderId = order.shipments?.[kind]?.dropiOrderId?.trim() ?? "";
  let carrierLabel = order.shipments?.[kind]?.carrierLabel ?? "";

  // La orden se cobra al crearla: si ya existe, no se crea otra aunque falle la guía.
  if (!dropiOrderId) {
    const options = await quoteDropi({ destinationDane, declaredValue: declared });
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
      getDropiProduct(isSizer ? dropiSizerProductId() : dropiRingProductId()),
    ]);

    const pieces = isSizer ? 1 : ringPieces(order);
    // Dropi rechaza la orden si el total no cubre precio del producto + flete («monto a ganar ≤ 0»).
    const floor = product.salePrice * pieces + chosen.totalPriceCop + 1000;
    const unitPrice = Math.max(1, Math.ceil(Math.max(declared, floor) / pieces));
    const detail = isSizer
      ? "Medidor de tallas"
      : order.items
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
      client_email: email.includes("@") ? email : "",
      notes: [order.orderNumber, detail].filter(Boolean).join(" · "),
      text_to_show_order_rotulo: `${isSizer ? "Medidor Mora" : "Anillo Mora"} · ${order.orderNumber}`,
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
    note: `Guía ${isSizer ? "del medidor" : "de los anillos"} ${guided.guide} · ${
      carrier ? dropiCarrierLabel(carrier) : carrierLabel || "Dropi"
    } · Dropi`,
  });
  await notifyGuideReady(orderId, kind);

  return (await getOrder(orderId)) ?? order;
}

export async function refreshOrderDropi(orderId: string, by: string) {
  requireDropi();
  const order = await getOrder(orderId);
  if (!order) throw new Error("Pedido no encontrado.");
  const kind = trackedKind(order);
  const leg = order.shipments?.[kind];
  const dropiOrderId = leg?.dropiOrderId?.trim() || leg?.hekaGuideId?.trim() || "";
  if (!dropiOrderId) throw new Error("Este pedido todavía no tiene guía.");

  const current = await getDropiOrder(dropiOrderId);
  const status = current.status || leg?.hekaStatus || "";
  const changed = status !== (leg?.hekaStatus ?? "");
  let next = await attachShippingGuide({
    orderId,
    by,
    kind,
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
