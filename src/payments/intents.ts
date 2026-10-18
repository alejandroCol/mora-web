import type { DocumentData } from "firebase-admin/firestore";
import { COLLECTIONS, PENDING_TTL_MS } from "@/commerce/paths";
import { adminDb } from "@/lib/firebaseAdmin";
import { mapBoldStatus } from "./status";
import type { PaymentIntent, PaymentPurpose } from "./types";

function intents() {
  return adminDb().collection(COLLECTIONS.paymentIntents);
}

function serializeIntent(id: string, data: DocumentData): PaymentIntent {
  return { id, ...(data as Omit<PaymentIntent, "id">) };
}

export async function getPaymentIntent(reference: string) {
  const snap = await intents().doc(reference).get();
  if (!snap.exists) return null;
  return serializeIntent(snap.id, snap.data()!);
}

export async function getPaymentIntentByTransactionId(transactionId: string) {
  const snap = await intents()
    .where("providerTransactionId", "==", transactionId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return serializeIntent(snap.docs[0].id, snap.docs[0].data());
}

export async function createPaymentIntent(input: {
  purpose: PaymentPurpose;
  reference: string;
  amountCop: number;
  redirectPath: string;
  metadata?: Record<string, string>;
  customerEmail?: string;
  expiresAt?: number;
}): Promise<PaymentIntent> {
  const now = Date.now();
  const intent: PaymentIntent = {
    id: input.reference,
    purpose: input.purpose,
    provider: "bold",
    reference: input.reference,
    amountCop: input.amountCop,
    currency: "COP",
    status: "created",
    redirectPath: input.redirectPath,
    metadata: input.metadata ?? {},
    customerEmail: input.customerEmail,
    expiresAt: input.expiresAt ?? now + PENDING_TTL_MS,
    createdAt: now,
    updatedAt: now,
  };
  await intents().doc(input.reference).set(intent);
  return intent;
}

export async function replacePaymentIntent(
  previousReference: string,
  next: Parameters<typeof createPaymentIntent>[0],
) {
  const db = adminDb();
  const prevRef = intents().doc(previousReference);
  const nextRef = intents().doc(next.reference);
  await db.runTransaction(async (tx) => {
    const prev = await tx.get(prevRef);
    if (prev.exists) {
      const data = prev.data() as PaymentIntent;
      if (data.status === "approved") {
        throw new Error("Ese pago ya está aprobado.");
      }
      tx.set(prevRef, { status: "error", updatedAt: Date.now() }, { merge: true });
    }
    const now = Date.now();
    const intent: PaymentIntent = {
      id: next.reference,
      purpose: next.purpose,
      provider: "bold",
      reference: next.reference,
      amountCop: next.amountCop,
      currency: "COP",
      status: "created",
      redirectPath: next.redirectPath,
      metadata: next.metadata ?? {},
      customerEmail: next.customerEmail,
      expiresAt: next.expiresAt ?? now + PENDING_TTL_MS,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(nextRef, intent);
  });
  return getPaymentIntent(next.reference);
}

export async function applyVoucherToIntent(
  reference: string,
  voucher: {
    total?: number;
    payment_status?: string;
    transaction_id?: string;
    payment_method?: string;
  },
): Promise<{ intent: PaymentIntent; duplicate: boolean } | null> {
  const ref = intents().doc(reference);
  return adminDb().runTransaction(async (runner) => {
    const snap = await runner.get(ref);
    if (!snap.exists) return null;
    const current = serializeIntent(snap.id, snap.data()!);
    const nextStatus = mapBoldStatus(voucher.payment_status ?? "PENDING");

    if (current.status === "approved") {
      return { intent: current, duplicate: true };
    }
    if (voucher.total != null && voucher.total !== current.amountCop) {
      throw new PaymentAmountMismatch(`Bold ${voucher.total} ≠ intent ${current.amountCop}`);
    }

    const now = Date.now();
    const patch: Partial<PaymentIntent> = {
      status: nextStatus,
      providerTransactionId: voucher.transaction_id,
      providerPaymentType: voucher.payment_method,
      providerStatus: voucher.payment_status,
      updatedAt: now,
    };
    if (nextStatus === "approved") patch.appliedAt = now;
    runner.set(ref, patch, { merge: true });
    return { intent: { ...current, ...patch } as PaymentIntent, duplicate: false };
  });
}

export class PaymentAmountMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentAmountMismatch";
  }
}

export function publicIntentView(intent: PaymentIntent) {
  return {
    reference: intent.reference,
    status: intent.status,
    purpose: intent.purpose,
    redirectPath: intent.redirectPath,
    amountCop: intent.amountCop,
    currency: intent.currency,
    metadata: intent.metadata,
    expiresAt: intent.expiresAt,
  };
}
