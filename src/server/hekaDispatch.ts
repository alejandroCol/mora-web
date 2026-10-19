import { codigoDaneEnviaCiudad } from "@/lib/colombiaGeo";
import type { MoraOrder } from "@/commerce/types";
import { orderNeedsSize } from "@/commerce/sizing";
import {
  createHekaGuide,
  hekaGuideConfigured,
  hekaStatusLabel,
  listHekaWarehouses,
  processHekaGuide,
  quoteHeka,
  refreshHekaGuide,
} from "./hekaClient";
import { attachShippingGuide, getOrder, transitionOrder } from "./orders";
import { loadCommerceSettings } from "./quoteShipping";

function phoneDigits(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length === 12) digits = digits.slice(2);
  return digits;
}

function packageOf(order: MoraOrder, settings: Awaited<ReturnType<typeof loadCommerceSettings>>) {
  const piezas = Math.max(1, order.items.reduce((sum, item) => sum + item.qty, 0));
  return {
    weightKg: Math.min(30, Math.max(0.1, settings.package.pesoKg * piezas)),
    heightCm: Math.min(80, Math.round(settings.package.altoCm + Math.max(0, piezas - 1) * 2)),
    longCm: Math.round(settings.package.largoCm),
    widthCm: Math.round(settings.package.anchoCm),
  };
}

export async function dispatchOrderWithHeka(orderId: string, by: string) {
  if (!hekaGuideConfigured()) {
    throw new Error("Faltan HEKA_API_KEY, HEKA_EMAIL y HEKA_PASSWORD.");
  }
  const order = await getOrder(orderId);
  if (!order) throw new Error("Pedido no encontrado.");
  if (order.status !== "paid" && order.status !== "in_transit") {
    throw new Error("Solo se guía un pedido pagado.");
  }
  if (orderNeedsSize(order.items)) {
    throw new Error("Falta la talla. El cliente aún no la confirmó.");
  }

  const phone = phoneDigits(order.customer.phone);
  if (!/^\d{7,10}$/.test(phone)) {
    throw new Error("El teléfono del cliente debe tener entre 7 y 10 dígitos.");
  }
  if (!order.shipping.direccion.trim() || !order.shipping.ciudad.trim()) {
    throw new Error("El pedido no tiene dirección de entrega.");
  }

  const settings = await loadCommerceSettings();
  const originDane = codigoDaneEnviaCiudad(settings.origin.departamento, settings.origin.ciudad);
  const destinationDane = codigoDaneEnviaCiudad(order.shipping.departamento, order.shipping.ciudad);
  if (!originDane || !destinationDane) {
    throw new Error("No encontramos el código de la ciudad de origen o de destino.");
  }

  let guideId = order.shipping.hekaGuideId?.trim() ?? "";
  let guideNumber = order.shipping.trackingNumber?.trim() ?? "";
  let status = order.shipping.hekaStatus?.trim() ?? "";

  if (!guideId) {
    const warehouses = await listHekaWarehouses();
    const preferred = process.env.HEKA_WAREHOUSE_ID?.trim();
    const warehouse = warehouses.find((row) => row.id === preferred) ?? warehouses[0];
    if (!warehouse) {
      throw new Error(
        "En Heka no hay una bodega activa. Si ya la creaste, actívala en el panel: sigue deshabilitada.",
      );
    }

    const pack = packageOf(order, settings);
    const declared = Math.max(25000, Math.round(order.totals.subtotal));
    const opciones = await quoteHeka({
      originDepartamento: settings.origin.departamento,
      originCiudad: settings.origin.ciudad,
      departamento: order.shipping.departamento,
      ciudad: order.shipping.ciudad,
      declaredValue: declared,
      ...pack,
    });
    const wanted = (order.shipping.carrier || settings.favoriteCarrier || "").toLowerCase();
    const chosen =
      opciones.find((option) => option.carrier === wanted) ??
      opciones.slice().sort((a, b) => a.totalPriceCop - b.totalPriceCop)[0];
    if (!chosen) throw new Error("Heka no tiene cobertura para esa ciudad.");

    const extra = order.items
      .map((item) => `${item.finishTitle}${item.size ? ` talla ${item.size}` : ""}`)
      .join(", ");
    const email = order.customer.email.trim();
    const guide = await createHekaGuide({
      type: 1,
      city_origin: originDane,
      city_destination: destinationDane,
      type_payment: 3,
      total: chosen.totalPriceCop,
      declared_value: declared,
      weight: pack.weightKg,
      height: pack.heightCm,
      long: pack.longCm,
      width: pack.widthCm,
      withshipping_cost: false,
      collection_value: 0,
      distributor_id: chosen.carrier,
      quantity: 1,
      note: order.orderNumber,
      product: "Anillo Mora",
      extra_info: extra || "Anillo",
      warehouse: warehouse.id,
      version: "1",
      in_order_form: false,
      collection_request: chosen.carrier === "tcc",
      inventory_allowed: false,
      client: {
        name: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
        address: order.shipping.direccion.trim(),
        phone: Number(phone),
        neighborhood: "Centro",
        locality: "",
        ...(email.includes("@") ? { email } : {}),
        ...(order.shipping.referencia?.trim()
          ? { note_destination: order.shipping.referencia.trim() }
          : {}),
      },
    });
    guideId = guide.id;
    guideNumber = guide.number;
    status = guide.status || "generated";
    await attachShippingGuide({
      orderId,
      by,
      shipping: {
        trackingNumber: guideNumber,
        hekaGuideId: guideId,
        hekaStatus: status,
        hekaStatusLabel: hekaStatusLabel(status),
        carrier: chosen.carrier,
        carrierLabel: chosen.carrierLabel,
        fuente: "heka",
      },
      note: `Guía ${guideNumber} · ${chosen.carrierLabel}`,
    });
  }

  if (guideId && status !== "progress" && status !== "finished" && status !== "in_office") {
    await processHekaGuide(guideId);
    status = "progress";
    await attachShippingGuide({
      orderId,
      by,
      shipping: { hekaStatus: status, hekaStatusLabel: hekaStatusLabel(status) },
      note: "Heka pasó la guía a transporte",
    });
  }

  const fresh = await getOrder(orderId);
  if (fresh && fresh.status === "paid") {
    return transitionOrder({
      orderId,
      to: "in_transit",
      by,
      trackingNumber: guideNumber,
      note: `En camino · guía ${guideNumber}`,
    });
  }
  return fresh ?? order;
}

export async function refreshOrderHeka(orderId: string, by: string) {
  if (!hekaGuideConfigured()) {
    throw new Error("Faltan HEKA_API_KEY, HEKA_EMAIL y HEKA_PASSWORD.");
  }
  const order = await getOrder(orderId);
  if (!order) throw new Error("Pedido no encontrado.");
  const number = order.shipping.trackingNumber?.trim();
  if (!number) throw new Error("Este pedido todavía no tiene guía.");

  const guide = await refreshHekaGuide(number);
  const status = guide.status || order.shipping.hekaStatus || "";
  const changed = status !== (order.shipping.hekaStatus ?? "");
  let next = await attachShippingGuide({
    orderId,
    by,
    shipping: {
      hekaGuideId: guide.id || order.shipping.hekaGuideId,
      hekaStatus: status,
      hekaStatusLabel: hekaStatusLabel(status),
      trackingNumber: guide.number || number,
    },
    note: changed ? `Heka · ${hekaStatusLabel(status)}` : undefined,
  });

  if (status === "finished" && next.status === "in_transit") {
    next = await transitionOrder({
      orderId,
      to: "delivered",
      by,
      note: "Heka marcó la guía como entregada",
    });
  }
  return next;
}
