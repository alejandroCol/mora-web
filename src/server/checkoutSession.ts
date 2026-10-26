import { PENDING_TTL_MS } from "@/commerce/paths";
import type { MoraOrder } from "@/commerce/types";
import { formatoDepartamentoEtiqueta } from "@/lib/colombiaGeo";
import { toCheckoutSession } from "@/payments/bold";
import {
  boldDocumentType,
  colombianMobile,
  createAddiSession,
  createBoldSession,
  recreateAddiSession,
  recreateBoldSession,
  resolveBoldEnvironment,
  type AddiCheckoutSession,
  type BoldCheckoutSession,
} from "@/payments";

function sessionInput(order: MoraOrder, origin: string, reference: string) {
  const piezas = order.items.reduce((sum, item) => sum + item.qty, 0);
  return {
    purpose: "order" as const,
    amountCop: order.totals.total,
    redirectPath: `/pedido/${order.orderNumber}`,
    origin,
    reference,
    expiresAt: order.expiresAt ?? Date.now() + PENDING_TTL_MS,
    description: piezas === 1 ? "Anillo Mora" : `${piezas} anillos Mora`,
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
    customer: {
      email: order.customer.email,
      fullName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
      phone: colombianMobile(order.customer.phone),
      dialCode: "+57",
      documentNumber: order.customer.documentNumber,
      documentType: boldDocumentType(order.customer.documentType),
    },
    billingAddress: {
      address: order.shipping.direccion,
      city: order.shipping.ciudad,
      state: formatoDepartamentoEtiqueta(order.shipping.departamento),
      country: "CO",
    },
  };
}

export async function boldSessionForOrder(
  order: MoraOrder,
  origin: string,
  reference: string,
): Promise<BoldCheckoutSession> {
  return createBoldSession(sessionInput(order, origin, reference));
}

export async function boldSessionRetry(
  order: MoraOrder,
  origin: string,
  previousReference: string,
): Promise<BoldCheckoutSession> {
  return recreateBoldSession(
    previousReference,
    sessionInput(order, origin, previousReference),
  );
}

export async function boldSessionReuse(
  order: MoraOrder,
  origin: string,
  reference: string,
): Promise<BoldCheckoutSession> {
  return toCheckoutSession({
    ...sessionInput(order, origin, reference),
    environment: await resolveBoldEnvironment(),
  });
}

export async function addiSessionForOrder(
  order: MoraOrder,
  origin: string,
  reference: string,
): Promise<AddiCheckoutSession> {
  return createAddiSession({ order, origin, reference });
}

export async function addiSessionRetry(
  order: MoraOrder,
  origin: string,
  previousReference: string,
): Promise<AddiCheckoutSession> {
  return recreateAddiSession({ order, origin, previousReference });
}
