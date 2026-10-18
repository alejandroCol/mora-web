import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, DOCS } from "@/commerce/paths";
import { commerceLineLabel } from "@/commerce/sizing";
import type { MoraOrder } from "@/commerce/types";
import { formatoDepartamentoEtiqueta } from "@/lib/colombiaGeo";
import { matiasConfig, type MatiasConfig } from "./config";
import {
  digitsOnly,
  matiasIdentityDocumentId,
  matiasTypeOrganizationId,
} from "./identity";
import { matiasSendInvoice } from "./matias";
import { buildInvoiceLines, copToDecimal2, type InvoiceLineInput } from "./tax";
import type { InvoiceEmitResult, InvoiceSnapshot } from "./types";

function log(phase: string, detail: Record<string, unknown> = {}) {
  console.log("[matias]", phase, detail);
}

function bogotaNowParts() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

function skipped(reason: string): InvoiceEmitResult {
  return {
    attempted: false,
    snapshot: { status: "skipped", skippedReason: reason, finalizedAt: Date.now() },
  };
}

function saleLines(order: MoraOrder): InvoiceLineInput[] {
  const lines: InvoiceLineInput[] = order.items
    .map((item) => ({
      description: commerceLineLabel(item).slice(0, 300),
      code: (item.sku || "ANILLO").slice(0, 50),
      gross: Math.round(item.unitPrice * item.qty),
    }))
    .filter((line) => line.gross > 0);

  if (order.totals.shipping > 0) {
    lines.push({
      description: "Envío",
      code: "ENVIO",
      gross: Math.round(order.totals.shipping),
    });
  }

  const payable = Math.round(order.totals.total);
  const sum = lines.reduce((total, line) => total + line.gross, 0);
  if (sum <= 0 || sum === payable) return lines;

  let remaining = payable;
  return lines
    .map((line, index) => {
      if (index === lines.length - 1) return { ...line, gross: remaining };
      const scaled = Math.round((line.gross * payable) / sum);
      remaining -= scaled;
      return { ...line, gross: scaled };
    })
    .filter((line) => line.gross > 0);
}

function customerAddress(order: MoraOrder) {
  const parts = [
    order.shipping.direccion.trim(),
    order.shipping.referencia?.trim(),
    formatoDepartamentoEtiqueta(order.shipping.ciudad),
    formatoDepartamentoEtiqueta(order.shipping.departamento),
  ].filter(Boolean);
  return parts.join(", ").slice(0, 200) || "Dirección no informada";
}

function invoiceAccepted(response: {
  success?: boolean;
  response?: { IsValid?: string };
}) {
  return response.success === true || response.response?.IsValid === "true";
}

const PENDING_TTL_MS = 2 * 60 * 1000;

async function reserveNumber(
  db: Firestore,
  order: MoraOrder,
  config: MatiasConfig,
): Promise<
  | { kind: "skip"; snapshot: InvoiceSnapshot }
  | { kind: "reserved"; documentNumber: string }
> {
  const orderRef = db.collection(COLLECTIONS.orders).doc(order.id);
  const seqRef = db.doc(DOCS.matiasInvoice);
  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(orderRef);
    const current = fresh.data() as MoraOrder | undefined;
    const existing = current?.invoice;
    if (existing?.status === "success") {
      return { kind: "skip" as const, snapshot: existing };
    }
    const pendingAge = Date.now() - (existing?.attemptedAt ?? 0);
    if (
      existing?.status === "pending" &&
      pendingAge < PENDING_TTL_MS
    ) {
      return { kind: "skip" as const, snapshot: existing };
    }
    if (
      existing?.status === "pending" &&
      existing.documentNumber?.trim()
    ) {
      const now = Date.now();
      tx.set(
        orderRef,
        { invoice: { ...existing, attemptedAt: now }, updatedAt: now },
        { merge: true },
      );
      return {
        kind: "reserved" as const,
        documentNumber: existing.documentNumber.trim(),
      };
    }

    const seq = await tx.get(seqRef);
    const last = seq.exists
      ? Number((seq.data() as { last?: number }).last ?? config.docNumberMin - 1)
      : config.docNumberMin - 1;
    const next = last + 1;
    if (next < config.docNumberMin || next > config.docNumberMax) {
      throw new Error(
        `Número de factura MATIAS fuera de rango (${config.docNumberMin}–${config.docNumberMax}).`,
      );
    }

    const now = Date.now();
    const snapshot: InvoiceSnapshot = {
      status: "pending",
      prefix: config.prefix,
      documentNumber: String(next),
      resolutionNumber: config.resolutionNumber,
      attemptedAt: now,
    };
    tx.set(seqRef, { last: next, updatedAt: now }, { merge: true });
    tx.set(orderRef, { invoice: snapshot, updatedAt: now }, { merge: true });
    return { kind: "reserved" as const, documentNumber: String(next) };
  });
}

function buildPayload(
  order: MoraOrder,
  config: MatiasConfig,
  documentNumber: string,
) {
  const breakdown = buildInvoiceLines(saleLines(order), config.withVat);
  const identityDocumentId = matiasIdentityDocumentId(order.customer.documentType);
  if (!identityDocumentId) {
    throw new Error("Tipo de documento no soportado por MATIAS.");
  }
  const dni = digitsOnly(order.customer.documentNumber);
  const email = order.customer.email.trim().toLowerCase();
  const phoneDigits = digitsOnly(order.customer.phone);
  const localPhone =
    phoneDigits.startsWith("57") && phoneDigits.length >= 12
      ? phoneDigits.slice(-10)
      : phoneDigits.slice(-10);
  const mobile = localPhone.length >= 10 ? localPhone : config.defaultMobile;
  const displayName = `${order.customer.firstName} ${order.customer.lastName}`
    .trim()
    .slice(0, 200);
  const { date, time } = bogotaNowParts();
  const { payable } = breakdown;

  return {
    resolution_number: config.resolutionNumber,
    prefix: config.prefix,
    notes: `Pedido ${order.orderNumber} — Mora`.slice(0, 500),
    document_number: documentNumber,
    date,
    time,
    graphic_representation: 1,
    send_email: 1,
    operation_type_id: 1,
    type_document_id: 7,
    payments: [
      {
        payment_method_id: 1,
        means_payment_id: config.meansElectronic,
        value_paid: copToDecimal2(payable),
      },
    ],
    customer: {
      country_id: "45",
      city_id: config.cityId,
      identity_document_id: identityDocumentId,
      type_organization_id: matiasTypeOrganizationId(order.customer.documentType),
      tax_regime_id: 2,
      tax_level_id: 5,
      company_name: displayName || "Cliente",
      dni,
      mobile,
      email,
      address: customerAddress(order),
      postal_code: config.postalCode,
    },
    lines: breakdown.lines.map((line) => ({
      invoiced_quantity: "1",
      quantity_units_id: "1093",
      line_extension_amount: copToDecimal2(line.lineExtension),
      free_of_charge_indicator: false,
      description: line.description,
      code: line.code,
      type_item_identifications_id: "4",
      reference_price_id: "1",
      price_amount: copToDecimal2(line.lineExtension),
      base_quantity: "1",
      ...(config.withVat
        ? {
            tax_totals: [
              {
                tax_id: "1",
                tax_amount: line.taxAmount,
                taxable_amount: line.taxableAmount,
                percent: 19,
              },
            ],
          }
        : {}),
    })),
    legal_monetary_totals: {
      line_extension_amount: copToDecimal2(breakdown.lineExtension),
      tax_exclusive_amount: breakdown.taxExclusiveAmount,
      tax_inclusive_amount: breakdown.taxInclusiveAmount,
      payable_amount: payable,
    },
    tax_totals: breakdown.documentTaxTotals,
  };
}

/**
 * Factura electrónica de un pedido de ecommerce ya pagado.
 * Idempotente: un pedido exitoso genera a lo sumo una factura.
 * Nunca lanza; el cobro no depende de MATIAS.
 */
export async function tryEmitPaidOrderInvoice(
  db: Firestore,
  order: MoraOrder,
): Promise<InvoiceEmitResult> {
  try {
    if (order.channel !== "online") return skipped("no_ecommerce");
    if (order.status !== "paid" || order.payment.status !== "approved") {
      return skipped("venta_no_exitosa");
    }
    if (order.invoice?.status === "success") {
      return { attempted: false, snapshot: order.invoice };
    }

    const config = matiasConfig();
    if (!config) {
      log("omitido", { orderId: order.id, reason: "sin_credenciales" });
      return skipped("sin_credenciales");
    }
    if (!Number.isFinite(order.totals.total) || order.totals.total <= 0) {
      return skipped("monto_invalido");
    }
    const dni = digitsOnly(order.customer.documentNumber);
    const email = order.customer.email.trim().toLowerCase();
    if (!dni || !email) return skipped("falta_doc_o_email");
    if (!matiasIdentityDocumentId(order.customer.documentType)) {
      return skipped("tipo_doc_no_soportado");
    }

    const reserved = await reserveNumber(db, order, config);
    if (reserved.kind === "skip") {
      log("omitido", {
        orderId: order.id,
        reason: "ya_emitida_o_en_curso",
        status: reserved.snapshot.status,
      });
      return { attempted: false, snapshot: reserved.snapshot };
    }

    const orderRef = db.collection(COLLECTIONS.orders).doc(order.id);
    try {
      const payload = buildPayload(order, config, reserved.documentNumber);
      log("enviando", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        documentNumber: reserved.documentNumber,
        prefix: config.prefix,
        amount: order.totals.total,
      });

      const response = await matiasSendInvoice(payload, config);
      const ok = invoiceAccepted(response);
      const now = Date.now();
      const snapshot: InvoiceSnapshot = {
        status: ok ? "success" : "failed",
        prefix: config.prefix,
        documentNumber: reserved.documentNumber,
        resolutionNumber: config.resolutionNumber,
        cufe: response.XmlDocumentKey,
        pdfUrl: response.pdf?.url,
        error: ok
          ? undefined
          : response.response?.StatusMessage || response.message || "rechazada",
        attemptedAt: now,
        finalizedAt: now,
      };
      await orderRef.set({ invoice: snapshot, updatedAt: now }, { merge: true });
      log(ok ? "ok" : "rechazada", {
        orderId: order.id,
        documentNumber: reserved.documentNumber,
        cufe: snapshot.cufe ?? null,
        error: snapshot.error ?? null,
      });
      return { attempted: true, snapshot };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const now = Date.now();
      const snapshot: InvoiceSnapshot = {
        status: "failed",
        prefix: config.prefix,
        documentNumber: reserved.documentNumber,
        resolutionNumber: config.resolutionNumber,
        error: message,
        attemptedAt: now,
        finalizedAt: now,
      };
      await orderRef
        .set({ invoice: snapshot, updatedAt: now }, { merge: true })
        .catch(() => undefined);
      console.error("[matias] fallo", { orderId: order.id, error: message });
      return { attempted: true, snapshot };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[matias] fallo", { orderId: order.id, error: message });
    return {
      attempted: true,
      snapshot: {
        status: "failed",
        error: message,
        attemptedAt: Date.now(),
        finalizedAt: Date.now(),
      },
    };
  }
}
