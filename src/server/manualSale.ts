import { cartCount, discountOf, subtotalOf, totalsOf } from "@/commerce/cartMath";
import { cartHasRing } from "@/commerce/lines";
import {
  isLinkMethod,
  looksLikeEmail,
  MANUAL_PAY_METHODS,
  manualDiscountOf,
  payLinkPath,
  type ManualDelivery,
  type ManualQuote,
  type ManualSaleContext,
  type ManualSaleRequest,
  type ManualStockHold,
} from "@/commerce/manualSale";
import { PROMO_PAY_GRACE_MS, type OrderPromo } from "@/commerce/promos";
import { availableUnits, cartLinesError, lineToOrderItem, normalizeCartLine } from "@/commerce/sku";
import type { CartLine, CustomerSnapshot, MoraOrder, ShippingSnapshot } from "@/commerce/types";
import { matiasIdentityDocumentId } from "@/invoices/identity";
import { matiasIsConfigured } from "@/invoices";
import {
  addiIsConfigured,
  boldIsConfigured,
  colombianMobile,
  newBoldReference,
  resolveAddiEnvironment,
  resolveBoldEnvironment,
} from "@/payments";
import { orderEligibleForAddi } from "@/payments/addi";
import { boldSessionForOrder } from "./checkoutSession";
import { demandFromItems, listInventory } from "./inventory";
import { createManualOrder, holdsStock, listPendingOrders, releaseExpiredCheckouts } from "./orders";
import { ensurePricing } from "./pricing";
import { livePromoNow } from "./promos";
import { quoteShipping } from "./quoteShipping";

/** Venta en mano: sin envío. Mismo destino que siempre han tenido las ventas en punto. */
const PICKUP_SHIPPING: ShippingSnapshot = {
  departamento: "",
  ciudad: "Atelier",
  direccion: "Venta en punto",
  envioCop: 0,
  fuente: "estatico",
};

function bad(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function cleanItems(raw: CartLine[] | undefined) {
  const items = (raw ?? []).filter((item) => item && item.qty > 0).map(normalizeCartLine);
  if (items.length === 0) bad("Añade al menos un producto.");
  const invalid = cartLinesError(items);
  if (invalid) bad(invalid);
  return items;
}

/** Lo que el formulario necesita para no ofrecer nada que no se pueda vender o cobrar. */
export async function manualSaleContext(): Promise<ManualSaleContext> {
  // Un apartado vencido no debe verse como «en checkout» hasta el próximo pedido.
  await releaseExpiredCheckouts().catch(() => undefined);
  const [inventory, pending, boldEnv, addiEnv, live] = await Promise.all([
    listInventory(),
    listPendingOrders().catch(() => []),
    resolveBoldEnvironment(),
    resolveAddiEnvironment(),
    livePromoNow().catch(() => null),
  ]);
  const stock: Record<string, number> = {};
  for (const row of inventory) {
    stock[row.sku] = availableUnits(row.units ?? 0, row.reserved ?? 0);
  }
  const holds: Record<string, ManualStockHold[]> = {};
  for (const order of pending) {
    if (!holdsStock(order)) continue;
    for (const [sku, qty] of demandFromItems(order.items)) {
      (holds[sku] ??= []).push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customer: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
        method: order.payment.method,
        channel: order.channel,
        qty,
        until: order.meta?.holdUntil ?? order.expiresAt ?? null,
      });
    }
  }
  return {
    stock,
    holds,
    bold: boldIsConfigured(boldEnv),
    addi: addiIsConfigured(addiEnv),
    invoice: matiasIsConfigured(),
    promo: live ? { label: live.label, percent: live.percent } : null,
  };
}

/** Misma cotización que el checkout: gratis con anillo, cotizada si es solo case. */
export async function manualSaleQuote(input: {
  items?: CartLine[];
  departamento?: string;
  ciudad?: string;
  direccion?: string;
}): Promise<ManualQuote> {
  await ensurePricing();
  const items = cleanItems(input.items);
  if (!input.departamento?.trim() || !input.ciudad?.trim()) {
    bad("Elige departamento y ciudad.");
  }
  return quoteShipping({
    departamento: input.departamento!,
    ciudad: input.ciudad!,
    direccion: input.direccion?.trim() || "Por confirmar",
    subtotal: subtotalOf(items),
    piezas: cartCount(items),
    conAnillo: cartHasRing(items),
  });
}

async function resolveShipping(
  delivery: ManualDelivery | undefined,
  items: CartLine[],
  customer: CustomerSnapshot,
): Promise<ShippingSnapshot> {
  if (!delivery || delivery.mode === "pickup") return PICKUP_SHIPPING;
  if (!delivery.departamento?.trim() || !delivery.ciudad?.trim() || !delivery.direccion?.trim()) {
    bad("Completa departamento, ciudad y dirección del envío.");
  }
  // El servidor vuelve a cotizar: el valor del envío no viene del navegador.
  const quote = await quoteShipping({
    departamento: delivery.departamento,
    ciudad: delivery.ciudad,
    direccion: delivery.direccion,
    nombre: `${customer.firstName} ${customer.lastName}`.trim(),
    telefono: customer.phone,
    subtotal: subtotalOf(items),
    piezas: cartCount(items),
    conAnillo: cartHasRing(items),
  });
  const selected =
    quote.opciones.find((option) => option.carrier === delivery.carrier) ?? quote.seleccionada;
  const referencia = delivery.referencia?.trim();
  return {
    departamento: delivery.departamento,
    ciudad: delivery.ciudad,
    direccion: delivery.direccion.trim(),
    envioCop: delivery.free ? 0 : (selected?.totalPriceCop ?? quote.envioCop),
    fuente: quote.fuente,
    ...(referencia ? { referencia } : {}),
    ...(selected?.carrier ? { carrier: selected.carrier } : {}),
    ...(selected?.carrierLabel ? { carrierLabel: selected.carrierLabel } : {}),
    ...(selected?.service ? { service: selected.service } : {}),
    ...(selected?.deliveryEstimate ? { deliveryEstimate: selected.deliveryEstimate } : {}),
  };
}

/** Pestañas abiertas antes de este formulario mandan `paymentMethod` y `shipping`. */
function withLegacyShape(body: ManualSaleRequest): ManualSaleRequest {
  const legacy = body as ManualSaleRequest & {
    paymentMethod?: ManualSaleRequest["payment"]["method"];
    shipping?: Partial<ShippingSnapshot>;
  };
  const payment =
    body.payment ?? (legacy.paymentMethod ? { method: legacy.paymentMethod, paid: true } : body.payment);
  const old = legacy.shipping;
  const delivery: ManualDelivery =
    body.delivery ??
    (old?.departamento && old.ciudad && old.direccion
      ? {
          mode: "ship",
          departamento: old.departamento,
          ciudad: old.ciudad,
          direccion: old.direccion,
          free: true,
        }
      : { mode: "pickup" });
  return { ...body, payment, delivery };
}

export type ManualSaleResult = {
  order: MoraOrder;
  /** Enlace para que el cliente pague (Link de pago o Addi pendientes). */
  payUrl?: string;
};

export async function createManualSale(
  body: ManualSaleRequest,
  staff: { uid: string },
  origin: string,
): Promise<ManualSaleResult> {
  await ensurePricing();
  body = withLegacyShape(body);
  const items = cleanItems(body.items);
  const payment = body.payment;
  if (!payment || !MANUAL_PAY_METHODS.includes(payment.method)) bad("Elige el medio de pago.");
  const paid = payment.paid !== false;
  const link = !paid && isLinkMethod(payment.method);
  const ship = body.delivery?.mode === "ship";

  const email = (body.customer?.email ?? "").trim().toLowerCase();
  const phone = (body.customer?.phone ?? "").trim();
  const documentNumber = (body.customer?.documentNumber ?? "").replace(/\D/g, "");
  const customer: CustomerSnapshot = {
    firstName: body.customer?.firstName?.trim() || "Cliente",
    lastName: body.customer?.lastName?.trim() ?? "",
    email,
    phone,
    ...(documentNumber
      ? { documentType: body.customer?.documentType?.trim() || "CC", documentNumber }
      : {}),
  };

  if (email && !looksLikeEmail(email)) bad("Revisa el correo del cliente.");
  if (ship && (!body.customer?.firstName?.trim() || phone.replace(/\D/g, "").length < 7)) {
    bad("Para enviar necesitamos nombre y teléfono de quien recibe.");
  }
  if (link && !email) bad("Para que pague por enlace necesitamos su correo.");
  if (body.invoice) {
    if (!matiasIsConfigured()) bad("La facturación electrónica no está configurada.");
    if (!documentNumber || !email) bad("La factura pide documento y correo del cliente.");
    if (!matiasIdentityDocumentId(customer.documentType)) bad("Ese tipo de documento no se puede facturar.");
  }

  const shipping = await resolveShipping(body.delivery, items, customer);
  const subtotal = subtotalOf(items);
  const live = await livePromoNow(PROMO_PAY_GRACE_MS).catch(() => null);
  const promoCop = live ? discountOf(subtotal, { kind: "percent", value: live.percent }) : 0;
  const { discountCop, promoApplied } = manualDiscountOf(subtotal, Number(body.discountCop), promoCop);
  const promo: OrderPromo | undefined = live
    ? {
        kind: live.kind,
        key: live.key,
        label: live.label,
        percent: live.percent,
        startsAt: live.startsAt,
        endsAt: live.endsAt,
        applied: promoApplied,
      }
    : undefined;
  const totals = totalsOf(items.map(lineToOrderItem), shipping.envioCop, discountCop);

  let boldReference: string | undefined;
  if (link) {
    if (totals.total <= 0) bad("Un pedido en cero no necesita enlace de pago.");
    if (payment.method === "bold") {
      if (!boldIsConfigured(await resolveBoldEnvironment())) bad("El link de pago aún no está configurado.");
      boldReference = newBoldReference("MORA");
    } else {
      if (!addiIsConfigured(await resolveAddiEnvironment())) bad("Addi aún no está configurado.");
      if (!/^3\d{9}$/.test(colombianMobile(phone))) bad("Addi pide un celular colombiano de 10 dígitos.");
      if (documentNumber.length < 5) bad("Addi pide la cédula o el NIT del cliente.");
      if (!orderEligibleForAddi({ items: items.map(lineToOrderItem), totals } as MoraOrder)) {
        bad("Este total no califica para pagar con Addi.");
      }
    }
  }

  const order = await createManualOrder({
    items,
    customer,
    shipping,
    payment: { method: payment.method, paid, reference: payment.reference?.trim().slice(0, 120) },
    invoice: body.invoice === true,
    discountCop,
    promo,
    boldReference,
    notes: body.notes,
    createdBy: staff.uid,
    channel: body.channel,
    conversationId: body.conversationId,
    attribution: body.attribution,
  });

  if (!link) return { order };
  if (boldReference) {
    // Deja listo el intento de pago: así el webhook de Bold encuentra el pedido.
    await boldSessionForOrder(order, origin, boldReference).catch((error) =>
      console.error("[venta manual] sesión Bold", error),
    );
  }
  return { order, payUrl: `${origin.replace(/\/$/, "")}${payLinkPath(order.orderNumber)}` };
}
