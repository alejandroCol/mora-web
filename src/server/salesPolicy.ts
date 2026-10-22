import { cache } from "react";
import { DOCS } from "@/commerce/paths";
import {
  DEFAULT_SALES_POLICY,
  isSalesMode,
  isValidSaleOn,
  resolveSalesPresentation,
  type SalesMode,
  type SalesPolicy,
} from "@/commerce/sales";
import { adminDb } from "@/lib/firebaseAdmin";

function asPolicy(data: Partial<SalesPolicy> | undefined): SalesPolicy {
  const saleOn =
    typeof data?.saleOn === "string" && isValidSaleOn(data.saleOn) ? data.saleOn : null;
  const mode: SalesMode =
    isSalesMode(data?.mode) && (data.mode === "immediate" || saleOn)
      ? data.mode
      : DEFAULT_SALES_POLICY.mode;
  return {
    mode: mode === "presale" && !saleOn ? "immediate" : mode,
    saleOn,
    updatedAt: typeof data?.updatedAt === "number" ? data.updatedAt : 0,
  };
}

export async function fetchFreshSalesPolicy(): Promise<SalesPolicy> {
  try {
    const snap = await adminDb().doc(DOCS.sales).get();
    if (!snap.exists) return DEFAULT_SALES_POLICY;
    return asPolicy(snap.data() as Partial<SalesPolicy>);
  } catch (error) {
    console.error("[sales policy]", error);
    return DEFAULT_SALES_POLICY;
  }
}

export const loadSalesPolicy = cache(fetchFreshSalesPolicy);

export async function getSalesPresentation() {
  return resolveSalesPresentation(await loadSalesPolicy());
}

export async function saveSalesPolicy(patch: {
  mode?: unknown;
  saleOn?: unknown;
}): Promise<SalesPolicy> {
  const current = await fetchFreshSalesPolicy();
  const mode = isSalesMode(patch.mode) ? patch.mode : current.mode;
  const rawSaleOn =
    typeof patch.saleOn === "string"
      ? patch.saleOn.trim()
      : patch.saleOn === null
        ? null
        : current.saleOn;

  if (rawSaleOn && !isValidSaleOn(rawSaleOn)) {
    throw Object.assign(new Error("La fecha de venta no es válida."), { status: 400 });
  }

  const saleOn = rawSaleOn && isValidSaleOn(rawSaleOn) ? rawSaleOn : null;
  if (mode === "presale" && !saleOn) {
    throw Object.assign(new Error("Indica la fecha de venta para activar la preventa."), {
      status: 400,
    });
  }

  const next: SalesPolicy = {
    mode,
    saleOn: saleOn ?? current.saleOn,
    updatedAt: Date.now(),
  };

  if (next.mode === "presale" && !next.saleOn) {
    throw Object.assign(new Error("Indica la fecha de venta para activar la preventa."), {
      status: 400,
    });
  }

  await adminDb().doc(DOCS.sales).set(next, { merge: true });
  return next;
}
