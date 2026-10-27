import { fulfillAddiPayment, fulfillBoldPayment } from "@/server/orders";
import {
  applyVoucherToIntent,
  createPaymentIntent,
  getPaymentIntent,
  getPaymentIntentByTransactionId,
  PaymentAmountMismatch,
  publicIntentView,
  replacePaymentIntent,
} from "./intents";
import { mapBoldStatus } from "./status";
import type {
  AddiCheckoutSession,
  AppliedPayment,
  BoldEnvironment,
  BoldWebhookEvent,
  CreateBoldSessionInput,
} from "./types";
import {
  addiWebhookHeaders,
  createAddiApplication,
  fetchAddiApplication,
  readAddiWebhookEvent,
  verifyAddiCallback,
} from "./addi";
import {
  boldIsConfigured,
  fetchBoldVoucher,
  newBoldReference,
  resolveBoldEnvironment,
  toCheckoutSession,
  verifyWebhookSignature,
} from "./bold";
import type { MoraOrder } from "@/commerce/types";

export { PaymentAmountMismatch };

export async function createAddiSession(input: {
  order: MoraOrder;
  origin: string;
  reference?: string;
}): Promise<AddiCheckoutSession> {
  const reference = input.reference?.trim() || newBoldReference("ADDI");
  await createPaymentIntent({
    purpose: "order",
    provider: "addi",
    reference,
    amountCop: input.order.totals.total,
    redirectPath: `/pedido/${input.order.orderNumber}`,
    metadata: { orderId: input.order.id, orderNumber: input.order.orderNumber },
    customerEmail: input.order.customer.email,
    expiresAt: input.order.expiresAt,
  });
  return createAddiApplication({
    order: input.order,
    reference,
    origin: input.origin,
  });
}

export async function recreateAddiSession(input: {
  order: MoraOrder;
  origin: string;
  previousReference: string;
}): Promise<AddiCheckoutSession> {
  const previous = await getPaymentIntent(input.previousReference);
  if (previous?.status === "approved") {
    throw new Error("Ese pago ya está aprobado.");
  }
  const reference = newBoldReference("ADDI");
  await replacePaymentIntent(input.previousReference, {
    purpose: "order",
    provider: "addi",
    reference,
    amountCop: input.order.totals.total,
    redirectPath: `/pedido/${input.order.orderNumber}`,
    metadata: { orderId: input.order.id, orderNumber: input.order.orderNumber },
    customerEmail: input.order.customer.email,
    expiresAt: input.order.expiresAt,
  });
  return createAddiApplication({
    order: input.order,
    reference,
    origin: input.origin,
  });
}

export async function createBoldSession(
  input: CreateBoldSessionInput & { origin: string },
) {
  const environment = await resolveBoldEnvironment();
  if (!boldIsConfigured(environment)) {
    throw new Error("Bold aún no está configurado.");
  }
  const reference = input.reference?.trim() || newBoldReference();
  await createPaymentIntent({
    purpose: input.purpose,
    reference,
    amountCop: Math.round(input.amountCop),
    redirectPath: input.redirectPath,
    metadata: input.metadata,
    customerEmail: input.customer?.email,
    expiresAt: input.expiresAt,
  });
  return toCheckoutSession({ ...input, reference, environment });
}

export async function recreateBoldSession(
  previousReference: string,
  input: CreateBoldSessionInput & { origin: string },
) {
  const environment = await resolveBoldEnvironment();
  if (!boldIsConfigured(environment)) {
    throw new Error("Bold aún no está configurado.");
  }
  const previous = await getPaymentIntent(previousReference);
  if (previous?.status === "approved") {
    throw new Error("Ese pago ya está aprobado.");
  }
  const reference = newBoldReference();
  await replacePaymentIntent(previousReference, {
    purpose: input.purpose,
    reference,
    amountCop: Math.round(input.amountCop),
    redirectPath: input.redirectPath,
    metadata: input.metadata,
    customerEmail: input.customer?.email,
    expiresAt: input.expiresAt,
  });
  return toCheckoutSession({ ...input, reference, environment });
}

export async function applyBoldVoucher(input: {
  reference: string;
  transactionId?: string;
  amountCop?: number;
  paymentType?: string;
  status: string;
}): Promise<AppliedPayment | null> {
  const voucher = {
    reference_id: input.reference,
    transaction_id: input.transactionId,
    total: input.amountCop,
    payment_method: input.paymentType,
    payment_status: input.status,
  };

  let applied = await applyVoucherToIntent(input.reference, voucher);
  if (!applied && input.transactionId) {
    const byTx = await getPaymentIntentByTransactionId(input.transactionId);
    if (byTx) applied = await applyVoucherToIntent(byTx.reference, voucher);
  }

  const purpose = applied?.intent.purpose ?? "order";
  if (purpose === "order") {
    await fulfillBoldPayment({
      reference: applied?.intent.reference ?? input.reference,
      transactionId: input.transactionId,
      amountCop: input.amountCop,
      paymentType: input.paymentType,
      status: input.status,
      orderId: applied?.intent.metadata.orderId,
    });
  }

  if (!applied) {
    const fallback = await getPaymentIntent(input.reference);
    if (!fallback) return null;
    return { intent: fallback, voucher, duplicate: fallback.status === "approved" };
  }
  return { intent: applied.intent, voucher, duplicate: applied.duplicate };
}

export async function syncBoldReference(reference: string) {
  const environment = await resolveBoldEnvironment();
  const voucher = await fetchBoldVoucher(reference, environment);
  const status = voucher.payment_status ?? "NO_TRANSACTION_FOUND";
  if (status === "NO_TRANSACTION_FOUND") {
    const intent = await getPaymentIntent(reference);
    return { voucher, applied: intent ? { intent, voucher, duplicate: false } : null };
  }
  const applied = await applyBoldVoucher({
    reference: voucher.reference_id ?? reference,
    transactionId: voucher.transaction_id,
    amountCop: voucher.total,
    paymentType: voucher.payment_method,
    status,
  });
  return { voucher, applied };
}

export async function handleBoldEvent(
  request: Request,
  options: { environment?: BoldEnvironment } = {},
) {
  const environment = options.environment ?? (await resolveBoldEnvironment());
  const raw = await request.text();
  const signature = request.headers.get("x-bold-signature");
  if (!verifyWebhookSignature(raw, signature, environment)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let payload: BoldWebhookEvent;
  try {
    payload = JSON.parse(raw) as BoldWebhookEvent;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const type = payload.type ?? "";
  if (!type.startsWith("SALE_") && !type.startsWith("VOID_")) {
    return Response.json({ ok: true });
  }

  const reference =
    payload.data?.metadata?.reference ?? payload.subject ?? payload.data?.payment_id ?? "";
  if (!reference) return Response.json({ ok: true });

  try {
    const voucher = await fetchBoldVoucher(reference, environment).catch(() => null);
    // El webhook de pruebas firma con secreto vacío: no marcar pedidos
    // reales si Bold sandbox no confirma el comprobante.
    if (environment === "test" && !voucher) {
      return Response.json({ ok: true, ignored: "no_test_voucher" });
    }
    await applyBoldVoucher({
      reference,
      transactionId: voucher?.transaction_id ?? payload.data?.payment_id,
      amountCop: voucher?.total ?? payload.data?.amount?.total,
      paymentType: voucher?.payment_method ?? payload.data?.payment_method,
      status: voucher?.payment_status ?? mapWebhookType(type),
    });
  } catch (error) {
    if (error instanceof PaymentAmountMismatch) {
      console.error("[bold] monto no coincide", error.message);
      return Response.json({ ok: true, ignored: "amount_mismatch" });
    }
    console.error("[bold] evento", error instanceof Error ? error.message : error);
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ ok: true });
}

function mapWebhookType(type: string) {
  switch (mapBoldStatus(type)) {
    case "approved":
      return "APPROVED";
    case "declined":
      return "REJECTED";
    case "voided":
      return "VOIDED";
    case "error":
      return "FAILED";
    default:
      return "PENDING";
  }
}

export async function applyAddiStatus(input: {
  reference: string;
  status: string;
  applicationId?: string;
  amountCop?: number;
}): Promise<AppliedPayment | null> {
  const voucher = {
    reference_id: input.reference,
    transaction_id: input.applicationId,
    total: input.amountCop,
    payment_method: "addi",
    payment_status: input.status,
  };

  const applied = await applyVoucherToIntent(input.reference, voucher);
  const normalized = input.status.trim().toUpperCase();
  const paidStatus =
    normalized === "COMPLETED" || normalized === "PAID" || normalized === "FUNDED"
      ? "APPROVED"
      : input.status;
  await fulfillAddiPayment({
    reference: applied?.intent.reference ?? input.reference,
    transactionId: input.applicationId,
    amountCop: input.amountCop,
    paymentType: "addi",
    status: paidStatus,
    orderId: applied?.intent.metadata.orderId,
  });

  if (!applied) {
    const fallback = await getPaymentIntent(input.reference);
    if (!fallback) return null;
    return { intent: fallback, voucher, duplicate: fallback.status === "approved" };
  }
  return { intent: applied.intent, voucher, duplicate: applied.duplicate };
}

export async function syncAddiReference(reference: string) {
  const remote = await fetchAddiApplication(reference);
  const status = remote?.status ?? remote?.applicationStatus;
  if (!status) {
    const intent = await getPaymentIntent(reference);
    return {
      voucher: { reference_id: reference, payment_status: intent?.providerStatus ?? "PENDING" },
      applied: intent ? { intent, voucher: { reference_id: reference }, duplicate: false } : null,
    };
  }
  const applied = await applyAddiStatus({
    reference,
    status,
    applicationId: remote?.applicationId ?? remote?.application_id ?? remote?.id,
    amountCop:
      remote?.totalAmount == null && remote?.amount == null
        ? undefined
        : Math.round(Number(remote?.totalAmount ?? remote?.amount)),
  });
  return {
    voucher: {
      reference_id: reference,
      payment_status: status,
      transaction_id: remote?.applicationId ?? remote?.id,
      payment_method: "addi",
    },
    applied,
  };
}

export async function handleAddiEvent(request: Request) {
  if (!verifyAddiCallback(request)) {
    return Response.json({ ok: false }, { status: 401, headers: addiWebhookHeaders() });
  }

  const raw = await request.text();
  let payload: unknown = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = Object.fromEntries(new URLSearchParams(raw));
    }
  }

  const event = readAddiWebhookEvent(payload);
  if (!event) {
    return Response.json({ ok: true, ignored: "empty" }, { headers: addiWebhookHeaders() });
  }

  const confirmed = await fetchAddiApplication(event.reference);
  const status = confirmed?.status ?? confirmed?.applicationStatus ?? event.status;

  try {
    await applyAddiStatus({
      reference: event.reference,
      status,
      applicationId: event.applicationId ?? confirmed?.applicationId ?? confirmed?.id,
      amountCop: event.amountCop,
    });
  } catch (error) {
    if (error instanceof PaymentAmountMismatch) {
      console.error("[addi] monto no coincide", error.message);
      return Response.json(
        { ok: true, ignored: "amount_mismatch" },
        { headers: addiWebhookHeaders() },
      );
    }
    console.error("[addi] evento", error instanceof Error ? error.message : error);
    return Response.json({ ok: false }, { status: 500, headers: addiWebhookHeaders() });
  }

  return Response.json({ ok: true }, { headers: addiWebhookHeaders() });
}

export async function readPaymentStatus(input: {
  reference?: string;
  transactionId?: string;
}) {
  if (input.transactionId) {
    const byTx = await getPaymentIntentByTransactionId(input.transactionId);
    if (byTx) return publicIntentView(byTx);
  }
  if (input.reference) {
    const intent = await getPaymentIntent(input.reference);
    if (intent) return publicIntentView(intent);
  }
  return null;
}
