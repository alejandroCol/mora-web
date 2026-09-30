import { catalog, finishes, type FinishId, type ModelId } from "@/lib/catalog";

export const FINANCE_CURRENCIES = ["COP", "USD", "CNY"] as const;
export type FinanceCurrency = (typeof FINANCE_CURRENCIES)[number];

export const EXPENSE_CATEGORIES = [
  "constitution",
  "import",
  "product",
  "accessory",
  "operations",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  constitution: "Constitución",
  import: "Importación",
  product: "Anillos",
  accessory: "Forros y cargadores",
  operations: "Operación",
  other: "Otro",
};

export const EXPENSE_CATEGORY_HINT: Record<ExpenseCategory, string> = {
  constitution: "Cámara de comercio, RUT, notaría, registro.",
  import: "Flete, aduana, nacionalización, seguro.",
  product: "Lo que pagas por los anillos.",
  accessory: "Forros, cargadores y extra del pedido.",
  operations: "Software, papelería, traslados, fees.",
  other: "Lo que no cabe arriba.",
};

export const ACCESSORY_KINDS = ["cover", "charger", "other"] as const;
export type AccessoryKind = (typeof ACCESSORY_KINDS)[number];

export const ACCESSORY_KIND_LABEL: Record<AccessoryKind, string> = {
  cover: "Forros",
  charger: "Cargadores",
  other: "Otro",
};

export const DEFAULT_LOAN_TERMS = {
  installmentCount: 12,
  graceMonths: 2,
  totalInterestRate: 0.2,
} as const;

export type FinanceAttachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
  expenseId?: string;
  createdAt: number;
  createdBy?: string;
};

export type FinanceExpense = {
  id: string;
  date: string;
  category: ExpenseCategory;
  title: string;
  vendor: string;
  amountCop: number;
  notes: string;
  attachmentIds: string[];
  relatedOrderId?: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
};

export type LoanInstallment = {
  number: number;
  dueDate: string;
  amount: number;
  paidAt: number | null;
};

export type FinanceLoan = {
  id: string;
  lender: string;
  principal: number;
  disbursedAt: string;
  installmentCount: number;
  graceMonths: number;
  totalInterestRate: number;
  notes: string;
  installments: LoanInstallment[];
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
};

export type PurchaseAccessory = {
  id: string;
  kind: AccessoryKind;
  label: string;
  qty: number;
  unitCost: number;
};

export type FinancePurchaseOrder = {
  id: string;
  title: string;
  supplier: string;
  orderedAt: string;
  notes: string;
  currency: FinanceCurrency;
  fxRateToCop: number;
  ringQty: Record<string, number>;
  ringCost: Record<string, number>;
  extras: PurchaseAccessory[];
  recordedExpenseIds: string[];
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
};

export type LoanDraft = {
  lender: string;
  principal: number;
  disbursedAt: string;
  installmentCount?: number;
  graceMonths?: number;
  totalInterestRate?: number;
  notes?: string;
};

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return EXPENSE_CATEGORIES.includes(value as ExpenseCategory);
}

export function isFinanceCurrency(value: unknown): value is FinanceCurrency {
  return FINANCE_CURRENCIES.includes(value as FinanceCurrency);
}

export function isAccessoryKind(value: unknown): value is AccessoryKind {
  return ACCESSORY_KINDS.includes(value as AccessoryKind);
}

export function todayISO(timeZone = "America/Bogota") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function monthKey(isoDate: string) {
  return isoDate.slice(0, 7);
}

export function currentMonthKey() {
  return monthKey(todayISO());
}

export function formatMonthTitle(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDay(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function addMonths(isoDate: string, months: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const cursor = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(
    Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const nextDay = Math.min(day, last);
  const y = cursor.getUTCFullYear();
  const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const d = String(nextDay).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function asMoney(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

export function asCop(value: unknown) {
  return Math.round(asMoney(value));
}

export function ringCostKey(modelId: ModelId, finishId: FinishId) {
  return `${modelId}__${finishId}`;
}

export function ringQtyKey(modelId: ModelId, finishId: FinishId, size: number) {
  return `${modelId}__${finishId}__${size}`;
}

export function loanInterest(principal: number, rate: number) {
  return asCop(principal * rate);
}

export function loanTotalDue(principal: number, rate: number) {
  return asCop(principal) + loanInterest(principal, rate);
}

export function installmentAmounts(total: number, count: number) {
  const safeCount = Math.max(1, Math.round(count));
  const base = Math.floor(asCop(total) / safeCount);
  const leftover = asCop(total) - base * safeCount;
  return Array.from({ length: safeCount }, (_, index) =>
    index === safeCount - 1 ? base + leftover : base,
  );
}

export function buildLoanSchedule(input: {
  principal: number;
  disbursedAt: string;
  installmentCount?: number;
  graceMonths?: number;
  totalInterestRate?: number;
  previous?: LoanInstallment[];
}): LoanInstallment[] {
  const count = Math.max(1, Math.round(input.installmentCount ?? DEFAULT_LOAN_TERMS.installmentCount));
  const grace = Math.max(0, Math.round(input.graceMonths ?? DEFAULT_LOAN_TERMS.graceMonths));
  const rate = input.totalInterestRate ?? DEFAULT_LOAN_TERMS.totalInterestRate;
  const amounts = installmentAmounts(loanTotalDue(input.principal, rate), count);
  const paid = new Map(
    (input.previous ?? [])
      .filter((row) => row.paidAt)
      .map((row) => [row.number, row.paidAt]),
  );
  return amounts.map((amount, index) => ({
    number: index + 1,
    dueDate: addMonths(input.disbursedAt, grace + index),
    amount,
    paidAt: paid.get(index + 1) ?? null,
  }));
}

export function loanPaidTotal(loan: FinanceLoan) {
  return loan.installments.reduce((sum, row) => sum + (row.paidAt ? row.amount : 0), 0);
}

export function loanOutstanding(loan: FinanceLoan) {
  return loanTotalDue(loan.principal, loan.totalInterestRate) - loanPaidTotal(loan);
}

export function loanMonthlyAmount(loan: Pick<FinanceLoan, "principal" | "totalInterestRate" | "installmentCount">) {
  const amounts = installmentAmounts(
    loanTotalDue(loan.principal, loan.totalInterestRate),
    loan.installmentCount,
  );
  return amounts[0] ?? 0;
}

export function dueInstallmentsInMonth(loans: FinanceLoan[], key = currentMonthKey()) {
  return loans.flatMap((loan) =>
    loan.installments
      .filter((row) => monthKey(row.dueDate) === key)
      .map((installment) => ({ loan, installment })),
  );
}

export function nextUnpaidInstallment(loan: FinanceLoan) {
  return loan.installments.find((row) => !row.paidAt) ?? null;
}

export function formatFinanceMoney(value: number, currency: FinanceCurrency = "COP") {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "COP" ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function toCop(amount: number, currency: FinanceCurrency, fxRateToCop: number) {
  if (currency === "COP") return asCop(amount);
  const rate = fxRateToCop > 0 ? fxRateToCop : 0;
  return asCop(amount * rate);
}

export type PurchaseTotals = {
  ringQty: number;
  ringCost: number;
  coverQty: number;
  coverCost: number;
  chargerQty: number;
  chargerCost: number;
  otherQty: number;
  otherCost: number;
  extrasCost: number;
  total: number;
  totalCop: number;
};

export function purchaseTotals(order: Pick<
  FinancePurchaseOrder,
  "ringQty" | "ringCost" | "extras" | "currency" | "fxRateToCop"
>): PurchaseTotals {
  let ringQty = 0;
  let ringCost = 0;
  for (const product of catalog) {
    for (const finishId of product.finishes) {
      const unit = asMoney(order.ringCost[ringCostKey(product.id, finishId)]);
      for (const size of product.sizes) {
        const qty = Math.max(0, Math.round(asMoney(order.ringQty[ringQtyKey(product.id, finishId, size)])));
        ringQty += qty;
        ringCost += qty * unit;
      }
    }
  }

  const extras = { coverQty: 0, coverCost: 0, chargerQty: 0, chargerCost: 0, otherQty: 0, otherCost: 0 };
  for (const extra of order.extras) {
    const qty = Math.max(0, Math.round(asMoney(extra.qty)));
    const cost = qty * asMoney(extra.unitCost);
    if (extra.kind === "cover") {
      extras.coverQty += qty;
      extras.coverCost += cost;
    } else if (extra.kind === "charger") {
      extras.chargerQty += qty;
      extras.chargerCost += cost;
    } else {
      extras.otherQty += qty;
      extras.otherCost += cost;
    }
  }

  const extrasCost = extras.coverCost + extras.chargerCost + extras.otherCost;
  const total = ringCost + extrasCost;
  return {
    ringQty,
    ringCost,
    ...extras,
    extrasCost,
    total,
    totalCop: toCop(total, order.currency, order.fxRateToCop),
  };
}

export function emptyPurchaseOrder(partial?: Partial<FinancePurchaseOrder>): Omit<
  FinancePurchaseOrder,
  "id" | "createdAt" | "updatedAt" | "createdBy"
> {
  return {
    title: partial?.title ?? "Primer pedido",
    supplier: partial?.supplier ?? "",
    orderedAt: partial?.orderedAt ?? todayISO(),
    notes: partial?.notes ?? "",
    currency: partial?.currency ?? "USD",
    fxRateToCop: partial?.fxRateToCop ?? 4000,
    ringQty: partial?.ringQty ?? {},
    ringCost: partial?.ringCost ?? {},
    extras: partial?.extras ?? [
      { id: "cover", kind: "cover", label: "Forros", qty: 0, unitCost: 0 },
      { id: "charger", kind: "charger", label: "Cargadores", qty: 0, unitCost: 0 },
    ],
    recordedExpenseIds: partial?.recordedExpenseIds ?? [],
  };
}

export function expenseCountsTowardTotal(expense: FinanceExpense) {
  return Boolean(expense.title.trim() || expense.amountCop > 0 || expense.vendor.trim());
}

export function spentByCategory(expenses: FinanceExpense[]) {
  const base = Object.fromEntries(EXPENSE_CATEGORIES.map((key) => [key, 0])) as Record<
    ExpenseCategory,
    number
  >;
  for (const expense of expenses) {
    if (!expenseCountsTowardTotal(expense)) continue;
    base[expense.category] += expense.amountCop;
  }
  return base;
}

export function finishTitle(finishId: FinishId) {
  return finishes[finishId].title;
}

export { catalog, finishes };
