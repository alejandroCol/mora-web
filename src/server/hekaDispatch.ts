import { codigoDaneEnviaCiudad } from "@/lib/colombiaGeo";
import type { MoraOrder } from "@/commerce/types";
import { orderNeedsSize, orderHasSizer } from "@/commerce/sizing";
import { guideKindFor } from "@/commerce/shipments";
import {
  createHekaGuide,
  hekaGuideConfigured,
  hekaPreferredWarehouseId,
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
  if (!(await hekaGuideConfigured())) {
    throw new Error("Faltan las credenciales de Heka para este entorno.");
  }
  const order = await getOrder(orderId);
  if (!order) throw new Error("Pedido no encontrado.");
  if (order.status !== "paid" && order.status !== "sizer_transit" && order.status !== "in_transit") {
    throw new Error("Solo se guía un pedido pagado.");
  }
  const kind = guideKindFor(order);
  if (!kind) {
    if (orderNeedsSize(order.items)) {
      throw new Error("Falta la talla. El cliente aún no la confirmó.");
    }
    throw new Error("Esta venta ya tiene la guía de este envío.");
  }
  if (kind === "rings" && orderHasSizer(order.items)) {
    const sizer = order.shipments?.sizer;
    if (sizer?.status !== "in_transit" && sizer?.status !== "delivered" && order.status !== "sizer_transit") {
      throw new Error("Primero crea la guía del medidor y márcalo en camino.");
    }
  }

  const phone = phoneDigits(order.customer.phone);
  if (!/^\d{7,10}$/.test(phone)) {
    throw new Error("El teléfono del cliente debe tener entre 7 y 10 dígitos.");
  }
  if (!order.shipping.direccion.trim() || !order.shipping.ciudad.trim()) {
    throw new Error("El pedido no tiene dirección de entrega.");
  }

  const settings = await loadCommerceSettings();
  const destinationDane = codigoDaneEnviaCiudad(order.shipping.departamento, order.shipping.ciudad);
  if (!destinationDane) {
    throw new Error("No encontramos el código de la ciudad de destino.");
  }

  const leg = kind === "sizer" ? order.shipments?.sizer : order.shipments?.rings;
  let guideId = leg?.hekaGuideId?.trim() ?? "";
  let guideNumber = leg?.trackingNumber?.trim() ?? "";
  let status = leg?.hekaStatus?.trim() ?? "";

  if (!guideId) {
    const warehouses = await listHekaWarehouses();
    const preferred = await hekaPreferredWarehouseId();
    const warehouse = warehouses.find((row) => row.id === preferred) ?? warehouses[0];
    if (!warehouse) {
      throw new Error(
        "En Heka no hay una bodega activa. Si ya la creaste, actívala en el panel: sigue deshabilitada.",
      );
    }

    const originDane =
      warehouse.dane || codigoDaneEnviaCiudad(settings.origin.departamento, settings.origin.ciudad);
    if (!originDane) {
      throw new Error("La bodega de Heka no tiene ciudad de origen.");
    }

    const pack = packageOf(order, settings);
    const declared = kind === "sizer" ? 25000 : Math.max(25000, Math.round(order.totals.subtotal));
    const opciones = await quoteHeka({
      originDepartamento: warehouse.departamento || settings.origin.departamento,
      originCiudad: warehouse.city || settings.origin.ciudad,
      cityOriginDane: originDane,
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
      declared_value: declared,
      weight: pack.weightKg,
      height: pack.heightCm,
      long: pack.longCm,
      width: pack.widthCm,
      withshipping_cost: false,
      collection_value: 0,
      distributor_id: chosen.carrier,
      quantity: 1,
      note: kind === "sizer" ? `${order.orderNumber} medidor` : order.orderNumber,
      product: kind === "sizer" ? "Medidor de tallas" : "Anillo Mora",
      extra_info_product: kind === "sizer" ? "Medidor Mora" : extra || "Anillo",
      warehouse: warehouse.id,
      version: "1",
      in_order_form: false,
      collection_request: chosen.carrier === "tcc",
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
      note: `Guía ${kind === "sizer" ? "del medidor" : "de los anillos"} ${guideNumber} · ${chosen.carrierLabel}`,
      kind,
    });
  }

  if (guideId && status !== "progress" && status !== "finished" && status !== "in_office") {
    await processHekaGuide(guideId);
    status = "progress";
    await attachShippingGuide({
      orderId,
      by,
      kind,
      shipping: { hekaStatus: status, hekaStatusLabel: hekaStatusLabel(status) },
      note: "Heka pasó la guía a transporte",
    });
  }

  return (await getOrder(orderId)) ?? order;
}

export async function refreshOrderHeka(orderId: string, by: string) {
  if (!(await hekaGuideConfigured())) {
    throw new Error("Faltan las credenciales de Heka para este entorno.");
  }
  const order = await getOrder(orderId);
  if (!order) throw new Error("Pedido no encontrado.");
  const sizerNumber = order.shipments?.sizer?.trackingNumber?.trim();
  const ringsNumber = order.shipments?.rings?.trackingNumber?.trim();
  const number = (
    order.status === "sizer_transit"
      ? sizerNumber || ringsNumber || order.shipping.trackingNumber
      : ringsNumber || sizerNumber || order.shipping.trackingNumber
  )?.trim();
  if (!number) throw new Error("Este pedido todavía no tiene guía.");
  const kind =
    sizerNumber === number && ringsNumber !== number
      ? "sizer"
      : ringsNumber === number
        ? "rings"
        : undefined;

  const guide = await refreshHekaGuide(number);
  const status = guide.status || order.shipping.hekaStatus || "";
  const changed = status !== (order.shipping.hekaStatus ?? "");
  let next = await attachShippingGuide({
    orderId,
    by,
    kind,
    shipping: {
      hekaGuideId: guide.id || order.shipping.hekaGuideId,
      hekaStatus: status,
      hekaStatusLabel: hekaStatusLabel(status),
      trackingNumber: guide.number || number,
    },
    note: changed ? `Heka · ${hekaStatusLabel(status)}` : undefined,
  });

  if (status === "finished" && next.status === "in_transit" && kind !== "sizer") {
    next = await transitionOrder({
      orderId,
      to: "delivered",
      by,
      note: "Heka marcó la guía como entregada",
    });
  }
  return next;
}
