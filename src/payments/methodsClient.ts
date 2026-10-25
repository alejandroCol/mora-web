"use client";

import { ADDI_MAX_COP_DEFAULT, ADDI_MIN_COP_DEFAULT } from "./public";

export type PayMethodAvailability = {
  bold: boolean;
  addi: boolean;
  minCop: number;
  maxCop: number;
};

const fallback: PayMethodAvailability = {
  bold: true,
  addi: false,
  minCop: ADDI_MIN_COP_DEFAULT,
  maxCop: ADDI_MAX_COP_DEFAULT,
};

let pending: Promise<PayMethodAvailability> | null = null;

export function loadPayMethods() {
  if (pending) return pending;
  pending = fetch("/api/checkout/methods")
    .then(async (res) => {
      const data = (await res.json()) as {
        methods?: { bold?: boolean; addi?: boolean };
        addi?: { minCop?: number; maxCop?: number };
      };
      return {
        bold: data.methods?.bold !== false,
        addi: Boolean(data.methods?.addi),
        minCop: data.addi?.minCop ?? ADDI_MIN_COP_DEFAULT,
        maxCop: data.addi?.maxCop ?? ADDI_MAX_COP_DEFAULT,
      } satisfies PayMethodAvailability;
    })
    .catch(() => {
      pending = null;
      return fallback;
    });
  return pending;
}
