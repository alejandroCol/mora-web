import { cache } from "react";
import { DOCS } from "@/commerce/paths";
import { DEFAULT_PAYMENT_POLICY, type PaymentPolicy } from "@/commerce/payments";
import { adminDb } from "@/lib/firebaseAdmin";

function asPolicy(data: Partial<PaymentPolicy> | undefined): PaymentPolicy {
  return {
    live: data?.live !== false,
    updatedAt: typeof data?.updatedAt === "number" ? data.updatedAt : 0,
  };
}

export async function fetchFreshPaymentPolicy(): Promise<PaymentPolicy> {
  try {
    const snap = await adminDb().doc(DOCS.payments).get();
    if (!snap.exists) return DEFAULT_PAYMENT_POLICY;
    return asPolicy(snap.data() as Partial<PaymentPolicy>);
  } catch (error) {
    console.error("[payments policy]", error);
    return DEFAULT_PAYMENT_POLICY;
  }
}

export const loadPaymentPolicy = cache(fetchFreshPaymentPolicy);

export async function isPaymentsLive() {
  return (await loadPaymentPolicy()).live;
}

export async function savePaymentPolicy(patch: { live?: unknown }): Promise<PaymentPolicy> {
  const current = await fetchFreshPaymentPolicy();
  const next: PaymentPolicy = {
    live: typeof patch.live === "boolean" ? patch.live : current.live,
    updatedAt: Date.now(),
  };
  await adminDb().doc(DOCS.payments).set(next, { merge: true });
  return next;
}
