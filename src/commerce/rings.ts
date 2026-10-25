import {
  asCop,
  asMoney,
  expenseCountsTowardTotal,
  ringCostKey,
  ringQtyKey,
  toCop,
  type FinanceExpense,
  type FinancePurchaseOrder,
} from "@/commerce/finance";
import { PAYMENT_METHOD_LABEL } from "@/commerce/labels";
import type { MoraOrder, OrderStatus, PaymentMethod } from "@/commerce/types";
import { catalog, products, type ModelId } from "@/lib/catalog";

export const RING_MODEL_IDS = ["aero", "titan"] as const satisfies readonly ModelId[];

export const RING_SOLD_STATUSES: OrderStatus[] = [
  "paid",
  "sizer_transit",
  "in_transit",
  "delivered",
];

export const RING_FEE_METHODS: PaymentMethod[] = [
  "bold",
  "wompi",
  "addi",
  "transferencia",
  "efectivo",
  "datafono",
];

export type IvaMode = "included" | "added";
export type CostLineKind = "fixed" | "percent";
export type CostLineKey = "unit_cost" | "shipping" | "payment_fee" | "iva" | "cac" | "custom";

export type RingCostLine = {
  id: string;
  key: CostLineKey;
  label: string;
  kind: CostLineKind;
  /** COP si es fijo. Porcentaje si es percent. `null` = usar el dato calculado. */
  amount: number | null;
  enabled: boolean;
};

export type RingModelConfig = {
  salePrice: number;
  useActualPrice: boolean;
  lines: RingCostLine[];
};

export type RingsEconomicsConfig = {
  ivaMode: IvaMode;
  paymentFees: Record<PaymentMethod, number>;
  models: Record<ModelId, RingModelConfig>;
  updatedAt: number;
};

export type PaymentMixRow = {
  method: PaymentMethod;
  label: string;
  rings: number;
  feeRate: number;
};

export type ResolvedCostLine = {
  line: RingCostLine;
  cost: number;
  hint?: string;
};

export type RingModelSnapshot = {
  modelId: ModelId;
  name: string;
  sold: number;
  revenue: number;
  avgPrice: number;
  salePrice: number;
  unitCostSuggested: number;
  paymentFeeRate: number;
  lines: ResolvedCostLine[];
  costTotal: number;
  profit: number;
  margin: number;
  profitOnSold: number;
};

export type RingsEconomicsSnapshot = {
  month: string;
  config: RingsEconomicsConfig;
  marketingSpend: number;
  sold: number;
  ordersSold: number;
  cac: number | null;
  cacPerOrder: number | null;
  paymentMix: PaymentMixRow[];
  models: Record<ModelId, RingModelSnapshot>;
};

export const DEFAULT_PAYMENT_FEES: Record<PaymentMethod, number> = {
  bold: 3.49,
  wompi: 3.19,
  addi: 0,
  transferencia: 0,
  efectivo: 0,
  datafono: 2.5,
};

const SYSTEM_LINES: RingCostLine[] = [
  { id: "unit_cost", key: "unit_cost", label: "Costo del anillo", kind: "fixed", amount: null, enabled: true },
  { id: "shipping", key: "shipping", label: "Envío", kind: "fixed", amount: 0, enabled: true },
  { id: "payment_fee", key: "payment_fee", label: "Comisión de pago", kind: "percent", amount: null, enabled: true },
  { id: "iva", key: "iva", label: "IVA", kind: "percent", amount: 19, enabled: true },
  { id: "cac", key: "cac", label: "CAC de marketing", kind: "fixed", amount: null, enabled: true },
];

export function isIvaMode(value: unknown): value is IvaMode {
  return value === "included" || value === "added";
}

export function isCostLineKind(value: unknown): value is CostLineKind {
  return value === "fixed" || value === "percent";
}

export function isCostLineKey(value: unknown): value is CostLineKey {
  return (
    value === "unit_cost" ||
    value === "shipping" ||
    value === "payment_fee" ||
    value === "iva" ||
    value === "cac" ||
    value === "custom"
  );
}

export function ringSold(order: Pick<MoraOrder, "status">) {
  return RING_SOLD_STATUSES.includes(order.status);
}

export function emptyModelConfig(modelId: ModelId): RingModelConfig {
  return {
    salePrice: products[modelId].price,
    useActualPrice: false,
    lines: SYSTEM_LINES.map((row) => ({ ...row })),
  };
}

export function defaultRingsConfig(): RingsEconomicsConfig {
  return {
    ivaMode: "included",
    paymentFees: { ...DEFAULT_PAYMENT_FEES },
    models: {
      aero: emptyModelConfig("aero"),
      titan: emptyModelConfig("titan"),
    },
    updatedAt: 0,
  };
}

function asNullableMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return asMoney(value);
}

function asLine(value: unknown, index: number): RingCostLine | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const key = isCostLineKey(row.key) ? row.key : "custom";
  const kind = isCostLineKind(row.kind) ? row.kind : key === "payment_fee" || key === "iva" ? "percent" : "fixed";
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `line-${index}`;
  const label =
    typeof row.label === "string" && row.label.trim()
      ? row.label.trim()
      : SYSTEM_LINES.find((item) => item.key === key)?.label || "Otro";
  return {
    id,
    key,
    label,
    kind,
    amount: asNullableMoney(row.amount),
    enabled: row.enabled !== false,
  };
}

function mergeSystemLines(lines: RingCostLine[]): RingCostLine[] {
  const byId = new Map(lines.map((row) => [row.id, row]));
  const merged = SYSTEM_LINES.map((system) => {
    const current = byId.get(system.id) ?? lines.find((row) => row.key === system.key && row.key !== "custom");
    return {
      ...system,
      amount: current ? current.amount : system.amount,
      enabled: current ? current.enabled : true,
      label: current?.label || system.label,
    } satisfies RingCostLine;
  });
  const used = new Set(merged.map((row) => row.id));
  const extras = lines.filter((row) => row.key === "custom" && !used.has(row.id));
  return [...merged, ...extras];
}

export function normalizeRingsConfig(raw: Partial<RingsEconomicsConfig> | undefined): RingsEconomicsConfig {
  const base = defaultRingsConfig();
  const fees = { ...base.paymentFees };
  if (raw?.paymentFees && typeof raw.paymentFees === "object") {
    for (const method of RING_FEE_METHODS) {
      const value = (raw.paymentFees as Record<string, unknown>)[method];
      if (value !== undefined) fees[method] = asMoney(value);
    }
  }
  const models = { ...base.models };
  for (const modelId of RING_MODEL_IDS) {
    const incoming = raw?.models?.[modelId];
    const fallback = emptyModelConfig(modelId);
    const lines = Array.isArray(incoming?.lines)
      ? incoming.lines
          .map((row, index) => asLine(row, index))
          .filter((row): row is RingCostLine => Boolean(row))
      : fallback.lines;
    models[modelId] = {
      salePrice: incoming?.salePrice && incoming.salePrice > 0 ? asCop(incoming.salePrice) : fallback.salePrice,
      useActualPrice: incoming?.useActualPrice === true,
      lines: mergeSystemLines(lines),
    };
  }
  return {
    ivaMode: isIvaMode(raw?.ivaMode) ? raw.ivaMode : base.ivaMode,
    paymentFees: fees,
    models,
    updatedAt: typeof raw?.updatedAt === "number" ? raw.updatedAt : 0,
  };
}

export function ivaOf(price: number, rate: number, mode: IvaMode) {
  if (rate <= 0 || price <= 0) return 0;
  if (mode === "included") return asCop((price * rate) / (100 + rate));
  return asCop((price * rate) / 100);
}

export function percentOf(price: number, rate: number) {
  if (rate <= 0 || price <= 0) return 0;
  return asCop((price * rate) / 100);
}

export function marketingSpendOf(expenses: FinanceExpense[], month?: string) {
  return expenses
    .filter((row) => row.category === "marketing" && expenseCountsTowardTotal(row))
    .filter((row) => !month || month === "all" || row.date.startsWith(month))
    .reduce((sum, row) => sum + row.amountCop, 0);
}

export function suggestedUnitCostByModel(orders: FinancePurchaseOrder[]): Record<ModelId, number> {
  const acc: Record<ModelId, { cost: number; qty: number }> = {
    aero: { cost: 0, qty: 0 },
    titan: { cost: 0, qty: 0 },
  };
  for (const order of orders) {
    for (const product of catalog) {
      for (const finishId of product.finishes) {
        const unit = asMoney(order.ringCost[ringCostKey(product.id, finishId)]);
        const unitCop = toCop(unit, order.currency, order.fxRateToCop);
        let qty = 0;
        for (const size of product.sizes) {
          qty += Math.max(0, Math.round(asMoney(order.ringQty[ringQtyKey(product.id, finishId, size)])));
        }
        acc[product.id].qty += qty;
        acc[product.id].cost += qty * unitCop;
      }
    }
  }
  return {
    aero: acc.aero.qty ? asCop(acc.aero.cost / acc.aero.qty) : 0,
    titan: acc.titan.qty ? asCop(acc.titan.cost / acc.titan.qty) : 0,
  };
}

export function orderMonthKey(order: Pick<MoraOrder, "paidAt" | "createdAt">) {
  const ms = order.paidAt && order.paidAt > 0 ? order.paidAt : order.createdAt;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(ms));
}

export function filterSoldOrders(orders: MoraOrder[], month?: string) {
  return orders.filter((order) => {
    if (!ringSold(order)) return false;
    if (!month || month === "all") return true;
    return orderMonthKey(order) === month;
  });
}

export function soldUnitsOf(order: Pick<MoraOrder, "items">, modelId?: ModelId) {
  return order.items.reduce((sum, item) => {
    if (modelId && item.modelId !== modelId) return sum;
    return sum + Math.max(0, Math.round(item.qty || 0));
  }, 0);
}

export function soldRevenueOf(order: Pick<MoraOrder, "items">, modelId?: ModelId) {
  return order.items.reduce((sum, item) => {
    if (modelId && item.modelId !== modelId) return sum;
    return sum + asCop(item.unitPrice) * Math.max(0, Math.round(item.qty || 0));
  }, 0);
}

export function paymentMixOf(
  orders: MoraOrder[],
  fees: Record<PaymentMethod, number>,
): { mix: PaymentMixRow[]; weightedFee: number } {
  const counts = Object.fromEntries(RING_FEE_METHODS.map((method) => [method, 0])) as Record<
    PaymentMethod,
    number
  >;
  let rings = 0;
  let weighted = 0;
  for (const order of orders) {
    const qty = soldUnitsOf(order);
    if (!qty) continue;
    const method = RING_FEE_METHODS.includes(order.payment.method) ? order.payment.method : "bold";
    counts[method] += qty;
    rings += qty;
    weighted += qty * asMoney(fees[method] ?? 0);
  }
  return {
    mix: RING_FEE_METHODS.filter((method) => counts[method] > 0 || fees[method] > 0).map((method) => ({
      method,
      label: PAYMENT_METHOD_LABEL[method],
      rings: counts[method],
      feeRate: asMoney(fees[method] ?? 0),
    })),
    weightedFee: rings > 0 ? Math.round((weighted / rings) * 100) / 100 : 0,
  };
}

export function resolveSalePrice(config: RingModelConfig, avgPrice: number) {
  if (config.useActualPrice && avgPrice > 0) return asCop(avgPrice);
  return config.salePrice > 0 ? asCop(config.salePrice) : asCop(avgPrice);
}

export function resolveUnitCost(line: RingCostLine, suggested: number) {
  if (!line.enabled) return 0;
  if (line.amount === null) return asCop(suggested);
  return asCop(line.amount);
}

export function resolvePaymentFeeRate(line: RingCostLine, mixRate: number) {
  if (!line.enabled) return 0;
  if (line.amount === null) return asMoney(mixRate);
  return asMoney(line.amount);
}

export function costOfLine(input: {
  line: RingCostLine;
  salePrice: number;
  ivaMode: IvaMode;
  cac: number;
  paymentFeeRate: number;
  unitCost: number;
}) {
  const { line, salePrice, ivaMode, cac, paymentFeeRate, unitCost } = input;
  if (!line.enabled) return 0;
  switch (line.key) {
    case "unit_cost":
      return asCop(unitCost);
    case "shipping":
      return asCop(line.amount ?? 0);
    case "payment_fee":
      return percentOf(salePrice, paymentFeeRate);
    case "iva":
      return ivaOf(salePrice, line.amount ?? 0, ivaMode);
    case "cac":
      return asCop(cac);
    case "custom":
      return line.kind === "percent" ? percentOf(salePrice, line.amount ?? 0) : asCop(line.amount ?? 0);
  }
}

export function buildModelSnapshot(input: {
  modelId: ModelId;
  config: RingsEconomicsConfig;
  orders: MoraOrder[];
  unitCostSuggested: number;
  cac: number;
  paymentFeeRate: number;
}): RingModelSnapshot {
  const model = input.config.models[input.modelId];
  const sold = input.orders.reduce((sum, order) => sum + soldUnitsOf(order, input.modelId), 0);
  const revenue = input.orders.reduce((sum, order) => sum + soldRevenueOf(order, input.modelId), 0);
  const avgPrice = sold > 0 ? asCop(revenue / sold) : 0;
  const salePrice = resolveSalePrice(model, avgPrice);
  const unitCostLine = model.lines.find((row) => row.key === "unit_cost") ?? SYSTEM_LINES[0];
  const feeLine = model.lines.find((row) => row.key === "payment_fee") ?? SYSTEM_LINES[2];
  const unitCost = resolveUnitCost(unitCostLine, input.unitCostSuggested);
  const paymentFeeRate = resolvePaymentFeeRate(feeLine, input.paymentFeeRate);
  const lines = model.lines.map((line) => {
    const cost = costOfLine({
      line,
      salePrice,
      ivaMode: input.config.ivaMode,
      cac: input.cac,
      paymentFeeRate,
      unitCost,
    });
    return {
      line,
      cost,
      hint: hintFor(line, {
        suggested: input.unitCostSuggested,
        mixRate: input.paymentFeeRate,
        cac: input.cac,
        ivaMode: input.config.ivaMode,
      }),
    };
  });
  const costTotal = lines.reduce((sum, row) => sum + row.cost, 0);
  const profit = asCop(salePrice - costTotal);
  const margin = salePrice > 0 ? profit / salePrice : 0;
  return {
    modelId: input.modelId,
    name: products[input.modelId].name,
    sold,
    revenue,
    avgPrice,
    salePrice,
    unitCostSuggested: input.unitCostSuggested,
    paymentFeeRate,
    lines,
    costTotal,
    profit,
    margin,
    profitOnSold: asCop(profit * sold),
  };
}

function hintFor(
  line: RingCostLine,
  ctx: { suggested: number; mixRate: number; cac: number; ivaMode: IvaMode },
) {
  if (line.key === "unit_cost" && line.amount === null) {
    return ctx.suggested > 0 ? "Del pedido a fábrica" : "Vacío usa el costo del pedido";
  }
  if (line.key === "payment_fee" && line.amount === null) {
    return `Mix real · ${ctx.mixRate.toLocaleString("es-CO", { maximumFractionDigits: 2 })}%`;
  }
  if (line.key === "iva") {
    return ctx.ivaMode === "included" ? "Incluido en el precio" : "Encima del precio";
  }
  if (line.key === "cac") {
    return "Marketing ÷ anillos vendidos";
  }
  return undefined;
}

export function buildRingsSnapshot(input: {
  month?: string;
  config: RingsEconomicsConfig;
  expenses: FinanceExpense[];
  purchaseOrders: FinancePurchaseOrder[];
  orders: MoraOrder[];
}): RingsEconomicsSnapshot {
  const month = input.month && input.month !== "all" ? input.month : "all";
  const soldOrders = filterSoldOrders(input.orders, month === "all" ? undefined : month);
  const marketingSpend = marketingSpendOf(input.expenses, month);
  const sold = soldOrders.reduce((sum, order) => sum + soldUnitsOf(order), 0);
  const ordersSold = soldOrders.length;
  const cac = sold > 0 ? asCop(marketingSpend / sold) : null;
  const cacPerOrder = ordersSold > 0 ? asCop(marketingSpend / ordersSold) : null;
  const mix = paymentMixOf(soldOrders, input.config.paymentFees);
  const suggested = suggestedUnitCostByModel(input.purchaseOrders);
  const models = Object.fromEntries(
    RING_MODEL_IDS.map((modelId) => [
      modelId,
      buildModelSnapshot({
        modelId,
        config: input.config,
        orders: soldOrders,
        unitCostSuggested: suggested[modelId],
        cac: cac ?? 0,
        paymentFeeRate: mix.weightedFee,
      }),
    ]),
  ) as Record<ModelId, RingModelSnapshot>;

  return {
    month,
    config: input.config,
    marketingSpend,
    sold,
    ordersSold,
    cac,
    cacPerOrder,
    paymentMix: mix.mix,
    models,
  };
}

export function newCustomLine(): RingCostLine {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `custom-${Date.now()}`;
  return {
    id,
    key: "custom",
    label: "Otro",
    kind: "fixed",
    amount: 0,
    enabled: true,
  };
}
