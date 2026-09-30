import type {
  FinanceAttachment,
  FinanceExpense,
  FinanceLoan,
  FinancePurchaseOrder,
} from "@/commerce/finance";

export type FinanceSnapshot = {
  expenses: FinanceExpense[];
  loans: FinanceLoan[];
  orders: FinancePurchaseOrder[];
  attachments: FinanceAttachment[];
};

export type FinanceMutator = (input: RequestInfo, init?: RequestInit) => Promise<FinanceSnapshot>;
