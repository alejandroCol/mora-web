"use client";

import type { BoldCheckoutSession } from "@/payments/types";

const KEY = "mora-pending-pay";

export type PendingPay = {
  orderNumber: string;
  reference: string;
  session: BoldCheckoutSession;
};

function canUseStore() {
  return typeof window !== "undefined";
}

export function readPendingPay(): PendingPay | null {
  if (!canUseStore()) return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPay;
    if (!parsed.orderNumber || !parsed.reference || !parsed.session?.checkout) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingPay(pending: PendingPay) {
  if (!canUseStore()) return;
  sessionStorage.setItem(KEY, JSON.stringify(pending));
}

export function clearPendingPay() {
  if (!canUseStore()) return;
  sessionStorage.removeItem(KEY);
}
