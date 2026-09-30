import { randomUUID } from "crypto";
import type { DocumentData } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/commerce/paths";
import {
  ACCESSORY_KIND_LABEL,
  asCop,
  asMoney,
  buildLoanSchedule,
  DEFAULT_LOAN_TERMS,
  emptyPurchaseOrder,
  isAccessoryKind,
  isExpenseCategory,
  isFinanceCurrency,
  purchaseTotals,
  todayISO,
  type ExpenseCategory,
  type FinanceAttachment,
  type FinanceExpense,
  type FinanceLoan,
  type FinancePurchaseOrder,
  type LoanDraft,
  type LoanInstallment,
  type PurchaseAccessory,
} from "@/commerce/finance";
import { adminBucket, adminDb } from "@/lib/firebaseAdmin";

const MAX_INLINE_CHARS = 900_000;

function expensesCol() {
  return adminDb().collection(COLLECTIONS.financeExpenses);
}
function loansCol() {
  return adminDb().collection(COLLECTIONS.financeLoans);
}
function ordersCol() {
  return adminDb().collection(COLLECTIONS.financeOrders);
}
function filesCol() {
  return adminDb().collection(COLLECTIONS.financeAttachments);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asIsoDate(value: unknown, fallback = todayISO()) {
  const raw = asString(value, fallback).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
}

function asExpense(id: string, data: DocumentData | undefined): FinanceExpense | null {
  if (!data) return null;
  const category: ExpenseCategory = isExpenseCategory(data.category) ? data.category : "other";
  return {
    id,
    date: asIsoDate(data.date),
    category,
    title: asString(data.title).trim(),
    vendor: asString(data.vendor).trim(),
    amountCop: asCop(data.amountCop),
    notes: asString(data.notes),
    attachmentIds: Array.isArray(data.attachmentIds)
      ? data.attachmentIds.filter((item): item is string => typeof item === "string")
      : [],
    relatedOrderId: typeof data.relatedOrderId === "string" ? data.relatedOrderId : undefined,
    createdAt: Number(data.createdAt ?? Date.now()),
    updatedAt: Number(data.updatedAt ?? Date.now()),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
  };
}

function asInstallment(value: unknown, index: number): LoanInstallment | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    number: Math.max(1, Math.round(Number(row.number ?? index + 1))),
    dueDate: asIsoDate(row.dueDate),
    amount: asCop(row.amount),
    paidAt: typeof row.paidAt === "number" && row.paidAt > 0 ? row.paidAt : null,
  };
}

function asLoan(id: string, data: DocumentData | undefined): FinanceLoan | null {
  if (!data) return null;
  const principal = asCop(data.principal);
  const disbursedAt = asIsoDate(data.disbursedAt);
  const installmentCount = Math.max(1, Math.round(Number(data.installmentCount ?? DEFAULT_LOAN_TERMS.installmentCount)));
  const graceMonths = Math.max(0, Math.round(Number(data.graceMonths ?? DEFAULT_LOAN_TERMS.graceMonths)));
  const totalInterestRate = Number(data.totalInterestRate ?? DEFAULT_LOAN_TERMS.totalInterestRate);
  const previous = Array.isArray(data.installments)
    ? data.installments
        .map((row, index) => asInstallment(row, index))
        .filter((row): row is LoanInstallment => Boolean(row))
    : [];
  return {
    id,
    lender: asString(data.lender).trim() || "Prestamista",
    principal,
    disbursedAt,
    installmentCount,
    graceMonths,
    totalInterestRate: Number.isFinite(totalInterestRate) ? totalInterestRate : DEFAULT_LOAN_TERMS.totalInterestRate,
    notes: asString(data.notes),
    installments: buildLoanSchedule({
      principal,
      disbursedAt,
      installmentCount,
      graceMonths,
      totalInterestRate,
      previous,
    }),
    createdAt: Number(data.createdAt ?? Date.now()),
    updatedAt: Number(data.updatedAt ?? Date.now()),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
  };
}

function asAccessory(value: unknown): PurchaseAccessory | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const kind = isAccessoryKind(row.kind) ? row.kind : "other";
  return {
    id: asString(row.id) || randomUUID(),
    kind,
    label: asString(row.label).trim() || ACCESSORY_KIND_LABEL[kind],
    qty: Math.max(0, Math.round(asMoney(row.qty))),
    unitCost: asMoney(row.unitCost),
  };
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key === "string") out[key] = asMoney(amount);
  }
  return out;
}

function asOrder(id: string, data: DocumentData | undefined): FinancePurchaseOrder | null {
  if (!data) return null;
  const extras = Array.isArray(data.extras)
    ? data.extras.map(asAccessory).filter((row): row is PurchaseAccessory => Boolean(row))
    : emptyPurchaseOrder().extras;
  return {
    id,
    title: asString(data.title).trim() || "Pedido",
    supplier: asString(data.supplier).trim(),
    orderedAt: asIsoDate(data.orderedAt),
    notes: asString(data.notes),
    currency: isFinanceCurrency(data.currency) ? data.currency : "USD",
    fxRateToCop: asMoney(data.fxRateToCop) || 0,
    ringQty: asRecord(data.ringQty),
    ringCost: asRecord(data.ringCost),
    extras,
    recordedExpenseIds: Array.isArray(data.recordedExpenseIds)
      ? data.recordedExpenseIds.filter((item): item is string => typeof item === "string")
      : [],
    createdAt: Number(data.createdAt ?? Date.now()),
    updatedAt: Number(data.updatedAt ?? Date.now()),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
  };
}

function asAttachment(id: string, data: DocumentData | undefined): FinanceAttachment | null {
  if (!data) return null;
  return {
    id,
    name: asString(data.name) || "soporte",
    mime: asString(data.mime) || "application/octet-stream",
    size: Number(data.size ?? 0),
    expenseId: typeof data.expenseId === "string" ? data.expenseId : undefined,
    createdAt: Number(data.createdAt ?? Date.now()),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
  };
}

function filePath(id: string) {
  return `finance/attachments/${id}`;
}

function parseDataUrl(raw: string) {
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw Object.assign(new Error("Archivo ilegible."), { status: 400 });
  }
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

export async function listExpenses(): Promise<FinanceExpense[]> {
  const snap = await expensesCol().get();
  return snap.docs
    .map((doc) => asExpense(doc.id, doc.data()))
    .filter((row): row is FinanceExpense => Boolean(row))
    .sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : a.date < b.date ? 1 : -1));
}

export async function listLoans(): Promise<FinanceLoan[]> {
  const snap = await loansCol().get();
  return snap.docs
    .map((doc) => asLoan(doc.id, doc.data()))
    .filter((row): row is FinanceLoan => Boolean(row))
    .sort((a, b) => (a.disbursedAt === b.disbursedAt ? a.createdAt - b.createdAt : a.disbursedAt.localeCompare(b.disbursedAt)));
}

export async function listOrders(): Promise<FinancePurchaseOrder[]> {
  const snap = await ordersCol().get();
  return snap.docs
    .map((doc) => asOrder(doc.id, doc.data()))
    .filter((row): row is FinancePurchaseOrder => Boolean(row))
    .sort((a, b) => (a.orderedAt === b.orderedAt ? b.createdAt - a.createdAt : a.orderedAt < b.orderedAt ? 1 : -1));
}

export async function listAttachments(): Promise<FinanceAttachment[]> {
  const snap = await filesCol().get();
  return snap.docs
    .map((doc) => asAttachment(doc.id, doc.data()))
    .filter((row): row is FinanceAttachment => Boolean(row))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function financeSnapshot() {
  const [expenses, loans, orders, attachments] = await Promise.all([
    listExpenses(),
    listLoans(),
    listOrders(),
    listAttachments(),
  ]);
  return { expenses, loans, orders, attachments };
}

export async function createExpense(
  input: Partial<FinanceExpense>,
  actorUid: string,
): Promise<FinanceExpense> {
  const now = Date.now();
  const record: FinanceExpense = {
    id: randomUUID(),
    date: asIsoDate(input.date),
    category: isExpenseCategory(input.category) ? input.category : "other",
    title: asString(input.title).trim(),
    vendor: asString(input.vendor).trim(),
    amountCop: asCop(input.amountCop),
    notes: asString(input.notes),
    attachmentIds: Array.isArray(input.attachmentIds) ? input.attachmentIds : [],
    relatedOrderId: input.relatedOrderId,
    createdAt: now,
    updatedAt: now,
    createdBy: actorUid,
  };
  await expensesCol().doc(record.id).set(record);
  return record;
}

export async function updateExpense(
  id: string,
  input: Partial<FinanceExpense>,
): Promise<FinanceExpense> {
  const ref = expensesCol().doc(id);
  const snap = await ref.get();
  const current = asExpense(id, snap.data());
  if (!current) {
    throw Object.assign(new Error("Gasto no encontrado."), { status: 404 });
  }
  const next: FinanceExpense = {
    ...current,
    date: input.date !== undefined ? asIsoDate(input.date, current.date) : current.date,
    category: input.category !== undefined && isExpenseCategory(input.category) ? input.category : current.category,
    title: input.title !== undefined ? asString(input.title).trim() : current.title,
    vendor: input.vendor !== undefined ? asString(input.vendor).trim() : current.vendor,
    amountCop: input.amountCop !== undefined ? asCop(input.amountCop) : current.amountCop,
    notes: input.notes !== undefined ? asString(input.notes) : current.notes,
    attachmentIds: Array.isArray(input.attachmentIds) ? input.attachmentIds : current.attachmentIds,
    relatedOrderId: input.relatedOrderId !== undefined ? input.relatedOrderId : current.relatedOrderId,
    updatedAt: Date.now(),
  };
  await ref.set(next, { merge: true });
  return next;
}

export async function deleteExpense(id: string) {
  const snap = await expensesCol().doc(id).get();
  const current = asExpense(id, snap.data());
  if (current) {
    await Promise.all(current.attachmentIds.map((fileId) => deleteAttachment(fileId).catch(() => undefined)));
  }
  await expensesCol().doc(id).delete();
}

export async function createLoan(input: LoanDraft, actorUid: string): Promise<FinanceLoan> {
  const lender = asString(input.lender).trim();
  if (!lender) {
    throw Object.assign(new Error("Quién te prestó."), { status: 400 });
  }
  const principal = asCop(input.principal);
  if (principal <= 0) {
    throw Object.assign(new Error("El préstamo debe ser mayor a cero."), { status: 400 });
  }
  const now = Date.now();
  const draft = {
    principal,
    disbursedAt: asIsoDate(input.disbursedAt),
    installmentCount: input.installmentCount ?? DEFAULT_LOAN_TERMS.installmentCount,
    graceMonths: input.graceMonths ?? DEFAULT_LOAN_TERMS.graceMonths,
    totalInterestRate: input.totalInterestRate ?? DEFAULT_LOAN_TERMS.totalInterestRate,
  };
  const record: FinanceLoan = {
    id: randomUUID(),
    lender,
    notes: asString(input.notes),
    ...draft,
    installments: buildLoanSchedule(draft),
    createdAt: now,
    updatedAt: now,
    createdBy: actorUid,
  };
  await loansCol().doc(record.id).set(record);
  return record;
}

export async function updateLoan(id: string, input: Partial<LoanDraft>): Promise<FinanceLoan> {
  const ref = loansCol().doc(id);
  const snap = await ref.get();
  const current = asLoan(id, snap.data());
  if (!current) {
    throw Object.assign(new Error("Préstamo no encontrado."), { status: 404 });
  }
  const nextDraft = {
    principal: input.principal !== undefined ? asCop(input.principal) : current.principal,
    disbursedAt: input.disbursedAt !== undefined ? asIsoDate(input.disbursedAt, current.disbursedAt) : current.disbursedAt,
    installmentCount: input.installmentCount ?? current.installmentCount,
    graceMonths: input.graceMonths ?? current.graceMonths,
    totalInterestRate: input.totalInterestRate ?? current.totalInterestRate,
    previous: current.installments,
  };
  const paid = current.installments.filter((row) => row.paidAt).length;
  if ((nextDraft.installmentCount ?? current.installmentCount) < paid) {
    throw Object.assign(new Error("Ya hay más cuotas pagadas que las que quieres dejar."), {
      status: 400,
    });
  }
  const next: FinanceLoan = {
    ...current,
    lender: input.lender !== undefined ? asString(input.lender).trim() || current.lender : current.lender,
    notes: input.notes !== undefined ? asString(input.notes) : current.notes,
    ...nextDraft,
    installments: buildLoanSchedule(nextDraft),
    updatedAt: Date.now(),
  };
  await ref.set(next);
  return next;
}

export async function setLoanInstallmentPaid(input: {
  id: string;
  number: number;
  paid: boolean;
}): Promise<FinanceLoan> {
  const ref = loansCol().doc(input.id);
  const snap = await ref.get();
  const current = asLoan(input.id, snap.data());
  if (!current) {
    throw Object.assign(new Error("Préstamo no encontrado."), { status: 404 });
  }
  const installments = current.installments.map((row) =>
    row.number === input.number
      ? { ...row, paidAt: input.paid ? row.paidAt ?? Date.now() : null }
      : row,
  );
  if (!installments.some((row) => row.number === input.number)) {
    throw Object.assign(new Error("Esa cuota no existe."), { status: 404 });
  }
  const next: FinanceLoan = { ...current, installments, updatedAt: Date.now() };
  await ref.set(next);
  return next;
}

export async function deleteLoan(id: string) {
  await loansCol().doc(id).delete();
}

export async function createOrder(
  input: Partial<FinancePurchaseOrder>,
  actorUid: string,
): Promise<FinancePurchaseOrder> {
  const now = Date.now();
  const blank = emptyPurchaseOrder(input);
  const record: FinancePurchaseOrder = {
    id: randomUUID(),
    ...blank,
    extras: (input.extras ?? blank.extras).map((row) => asAccessory(row)).filter((row): row is PurchaseAccessory => Boolean(row)),
    createdAt: now,
    updatedAt: now,
    createdBy: actorUid,
  };
  await ordersCol().doc(record.id).set(record);
  return record;
}

export async function updateOrder(
  id: string,
  input: Partial<FinancePurchaseOrder>,
): Promise<FinancePurchaseOrder> {
  const ref = ordersCol().doc(id);
  const snap = await ref.get();
  const current = asOrder(id, snap.data());
  if (!current) {
    throw Object.assign(new Error("Pedido no encontrado."), { status: 404 });
  }
  const next: FinancePurchaseOrder = {
    ...current,
    title: input.title !== undefined ? asString(input.title).trim() || current.title : current.title,
    supplier: input.supplier !== undefined ? asString(input.supplier).trim() : current.supplier,
    orderedAt: input.orderedAt !== undefined ? asIsoDate(input.orderedAt, current.orderedAt) : current.orderedAt,
    notes: input.notes !== undefined ? asString(input.notes) : current.notes,
    currency: input.currency !== undefined && isFinanceCurrency(input.currency) ? input.currency : current.currency,
    fxRateToCop: input.fxRateToCop !== undefined ? asMoney(input.fxRateToCop) : current.fxRateToCop,
    ringQty: input.ringQty !== undefined ? asRecord(input.ringQty) : current.ringQty,
    ringCost: input.ringCost !== undefined ? asRecord(input.ringCost) : current.ringCost,
    extras: input.extras !== undefined
      ? input.extras.map((row) => asAccessory(row)).filter((row): row is PurchaseAccessory => Boolean(row))
      : current.extras,
    recordedExpenseIds: Array.isArray(input.recordedExpenseIds)
      ? input.recordedExpenseIds
      : current.recordedExpenseIds,
    updatedAt: Date.now(),
  };
  await ref.set(next);
  return next;
}

export async function deleteOrder(id: string) {
  await ordersCol().doc(id).delete();
}

export async function recordOrderAsExpenses(orderId: string, actorUid: string) {
  const order = asOrder(orderId, (await ordersCol().doc(orderId).get()).data());
  if (!order) {
    throw Object.assign(new Error("Pedido no encontrado."), { status: 404 });
  }
  if (order.recordedExpenseIds.length > 0) {
    throw Object.assign(new Error("Este pedido ya está en el libro de gastos."), { status: 409 });
  }
  const totals = purchaseTotals(order);
  const created: FinanceExpense[] = [];
  if (totals.ringCost > 0) {
    created.push(
      await createExpense(
        {
          date: order.orderedAt,
          category: "product",
          title: `${order.title} · anillos`,
          vendor: order.supplier,
          amountCop: totals.totalCop && totals.total ? asCop((totals.ringCost / totals.total) * totals.totalCop) : toCopSafe(totals.ringCost, order),
          notes: `${totals.ringQty} anillos`,
          relatedOrderId: order.id,
        },
        actorUid,
      ),
    );
  }
  if (totals.extrasCost > 0) {
    created.push(
      await createExpense(
        {
          date: order.orderedAt,
          category: "accessory",
          title: `${order.title} · forros y cargadores`,
          vendor: order.supplier,
          amountCop:
            totals.totalCop && totals.total
              ? asCop((totals.extrasCost / totals.total) * totals.totalCop)
              : toCopSafe(totals.extrasCost, order),
          notes: [
            totals.coverQty ? `${totals.coverQty} forros` : "",
            totals.chargerQty ? `${totals.chargerQty} cargadores` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          relatedOrderId: order.id,
        },
        actorUid,
      ),
    );
  }
  if (created.length === 0) {
    throw Object.assign(new Error("El pedido está vacío."), { status: 400 });
  }
  await updateOrder(order.id, { recordedExpenseIds: created.map((row) => row.id) });
  return created;
}

function toCopSafe(amount: number, order: FinancePurchaseOrder) {
  if (order.currency === "COP") return asCop(amount);
  return asCop(amount * (order.fxRateToCop || 0));
}

export async function saveAttachment(input: {
  name: string;
  mime?: string;
  data: string;
  expenseId?: string;
  actorUid: string;
}): Promise<FinanceAttachment> {
  if (!input.data.startsWith("data:")) {
    throw Object.assign(new Error("Archivo inválido."), { status: 400 });
  }
  if (input.data.length > MAX_INLINE_CHARS * 1.4) {
    throw Object.assign(new Error("El archivo pesa demasiado (máx. ~4 MB)."), { status: 400 });
  }
  const parsed = parseDataUrl(input.data);
  const mime = input.mime?.trim() || parsed.mime;
  if (!mime.startsWith("image/") && mime !== "application/pdf") {
    throw Object.assign(new Error("Solo imagen o PDF."), { status: 400 });
  }
  const id = randomUUID();
  const now = Date.now();
  let stored: "storage" | "inline" = "inline";
  try {
    const bucket = adminBucket();
    await bucket.file(filePath(id)).save(parsed.buffer, {
      contentType: mime,
      resumable: false,
      metadata: { cacheControl: "private, max-age=0" },
    });
    stored = "storage";
  } catch {
    if (input.data.length > MAX_INLINE_CHARS) {
      throw Object.assign(new Error("No se pudo guardar el archivo. Prueba uno más liviano."), {
        status: 400,
      });
    }
  }
  const record = {
    id,
    name: input.name.trim() || (mime === "application/pdf" ? "factura.pdf" : "soporte.jpg"),
    mime,
    size: parsed.buffer.length,
    expenseId: input.expenseId,
    createdAt: now,
    createdBy: input.actorUid,
    stored,
    ...(stored === "inline" ? { data: input.data } : {}),
  };
  await filesCol().doc(id).set(record);
  if (input.expenseId) {
    const expense = asExpense(input.expenseId, (await expensesCol().doc(input.expenseId).get()).data());
    if (expense && !expense.attachmentIds.includes(id)) {
      await updateExpense(expense.id, { attachmentIds: [...expense.attachmentIds, id] });
    }
  }
  return {
    id,
    name: record.name,
    mime: record.mime,
    size: record.size,
    expenseId: record.expenseId,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
  };
}

export async function readAttachment(id: string): Promise<{
  meta: FinanceAttachment;
  data?: string;
  buffer?: Buffer;
}> {
  const snap = await filesCol().doc(id).get();
  const meta = asAttachment(id, snap.data());
  if (!meta) {
    throw Object.assign(new Error("Soporte no encontrado."), { status: 404 });
  }
  const data = snap.data();
  if (data?.stored === "storage") {
    try {
      const [buffer] = await adminBucket().file(filePath(id)).download();
      return { meta, buffer };
    } catch {
      /* fall through */
    }
  }
  if (typeof data?.data === "string") {
    return { meta, data: data.data };
  }
  throw Object.assign(new Error("El archivo ya no está."), { status: 404 });
}

export async function deleteAttachment(id: string) {
  const snap = await filesCol().doc(id).get();
  const data = snap.data();
  if (data?.stored === "storage") {
    try {
      await adminBucket().file(filePath(id)).delete({ ignoreNotFound: true });
    } catch {
      /* ignore */
    }
  }
  if (typeof data?.expenseId === "string") {
    const expense = asExpense(data.expenseId, (await expensesCol().doc(data.expenseId).get()).data());
    if (expense) {
      await updateExpense(expense.id, {
        attachmentIds: expense.attachmentIds.filter((item) => item !== id),
      });
    }
  }
  await filesCol().doc(id).delete();
}
