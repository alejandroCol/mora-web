"use client";

import { useRef, useState } from "react";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_HINT,
  EXPENSE_CATEGORY_LABEL,
  formatDay,
  formatFinanceMoney,
  type ExpenseCategory,
  type FinanceAttachment,
  type FinanceExpense,
} from "@/commerce/finance";
import { compressImage } from "@/lib/compressImage";
import { useAdminAuth } from "../AdminAuth";
import { MoneyInput } from "./moneyInput";
import type { FinanceMutator, FinanceSnapshot } from "./types";

const fieldClass =
  "h-10 w-full rounded-2xl bg-white/8 px-3 text-[13px] text-white placeholder:text-white/25";

async function fileToPayload(file: File) {
  if (file.type.startsWith("image/")) {
    return { name: file.name, mime: "image/jpeg", data: await compressImage(file, 1600, 0.82) };
  }
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("Solo PDF o imagen.");
  if (file.size > 4_500_000) throw new Error("El PDF pesa demasiado (máx. 4.5 MB).");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el PDF."));
    reader.readAsDataURL(file);
  });
  return { name: file.name, mime: "application/pdf", data };
}

function filesFor(expense: FinanceExpense, attachments: FinanceAttachment[]) {
  return attachments.filter((file) => expense.attachmentIds.includes(file.id));
}

export function ExpenseLedger({
  snapshot,
  mutate,
}: {
  snapshot: FinanceSnapshot;
  mutate: FinanceMutator;
}) {
  const { token } = useAdminAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExpenseCategory | "all">("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingExpense = useRef<string | null>(null);

  const rows = snapshot.expenses.filter((row) => filter === "all" || row.category === filter);

  async function patch(id: string, body: Partial<FinanceExpense>) {
    setBusy(id);
    setError("");
    try {
      await mutate(`/api/admin/finance/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(null);
    }
  }

  async function addRow(category: ExpenseCategory = "other") {
    setBusy("new");
    setError("");
    try {
      await mutate("/api/admin/finance/expenses", {
        method: "POST",
        body: JSON.stringify({ category, title: "", amountCop: 0 }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setBusy(null);
    }
  }

  async function openFile(id: string) {
    const res = await fetch(`/api/admin/finance/files/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setError("No se pudo abrir el soporte.");
      return;
    }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  }

  async function onPickFile(file: File | undefined) {
    const expenseId = pendingExpense.current;
    pendingExpense.current = null;
    if (!file || !expenseId) return;
    setBusy(expenseId);
    setError("");
    try {
      const payload = await fileToPayload(file);
      await mutate("/api/admin/finance/files", {
        method: "POST",
        body: JSON.stringify({ ...payload, expenseId }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="frame-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl tracking-[-0.05em]">El libro.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
            Cambia un campo y sal. Se guarda solo. Adjunta la factura si la tienes.
          </p>
        </div>
        <button
          type="button"
          disabled={busy === "new"}
          onClick={() => void addRow(filter === "all" ? "other" : filter)}
          className="h-10 rounded-full bg-white px-5 text-[13px] text-[#0e0d14]"
        >
          Añadir gasto
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Todo" />
        {EXPENSE_CATEGORIES.map((key) => (
          <FilterChip
            key={key}
            active={filter === key}
            onClick={() => setFilter(key)}
            label={EXPENSE_CATEGORY_LABEL[key]}
          />
        ))}
      </div>
      {filter !== "all" ? (
        <p className="mt-3 text-[12px] text-white/35">{EXPENSE_CATEGORY_HINT[filter]}</p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void onPickFile(file);
        }}
      />

      <ul className="mt-8 space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-[1.5rem] bg-white/[0.04] px-5 py-8 text-sm text-white/40">
            Aquí va constitución, importación, anillos y lo de todos los días.
          </li>
        ) : null}
        {rows.map((row) => {
          const files = filesFor(row, snapshot.attachments);
          return (
            <li key={row.id} className="rounded-[1.5rem] bg-white/[0.04] p-4 sm:p-5">
              <div className="grid gap-3 lg:grid-cols-[7.5rem_9.5rem_minmax(0,1fr)_minmax(0,0.8fr)_8rem] lg:items-center">
                <label className="block text-[10px] uppercase tracking-[0.12em] text-white/35">
                  Fecha
                  <input
                    type="date"
                    defaultValue={row.date}
                    key={row.date}
                    onBlur={(event) => {
                      if (event.target.value && event.target.value !== row.date) {
                        void patch(row.id, { date: event.target.value });
                      }
                    }}
                    className={`${fieldClass} mt-1`}
                  />
                </label>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-white/35">
                  Tipo
                  <select
                    value={row.category}
                    onChange={(event) =>
                      void patch(row.id, { category: event.target.value as ExpenseCategory })
                    }
                    className={`${fieldClass} mt-1`}
                  >
                    {EXPENSE_CATEGORIES.map((key) => (
                      <option key={key} value={key}>
                        {EXPENSE_CATEGORY_LABEL[key]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-white/35">
                  Qué
                  <input
                    defaultValue={row.title}
                    key={`title-${row.id}-${row.updatedAt}`}
                    placeholder="Cámara de comercio, flete…"
                    onBlur={(event) => {
                      if (event.target.value.trim() !== row.title) {
                        void patch(row.id, { title: event.target.value });
                      }
                    }}
                    className={`${fieldClass} mt-1`}
                  />
                </label>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-white/35">
                  A quién
                  <input
                    defaultValue={row.vendor}
                    key={`vendor-${row.id}-${row.updatedAt}`}
                    placeholder="Proveedor o entidad"
                    onBlur={(event) => {
                      if (event.target.value.trim() !== row.vendor) {
                        void patch(row.id, { vendor: event.target.value });
                      }
                    }}
                    className={`${fieldClass} mt-1`}
                  />
                </label>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-white/35">
                  COP
                  <MoneyInput
                    value={row.amountCop}
                    ariaLabel="Valor en pesos"
                    onCommit={(amountCop) => void patch(row.id, { amountCop })}
                    className={`${fieldClass} mt-1 text-right`}
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  defaultValue={row.notes}
                  key={`notes-${row.id}-${row.updatedAt}`}
                  placeholder="Nota corta"
                  onBlur={(event) => {
                    if (event.target.value !== row.notes) {
                      void patch(row.id, { notes: event.target.value });
                    }
                  }}
                  className="h-9 min-w-[12rem] flex-1 rounded-full bg-white/6 px-3 text-[12px] text-white placeholder:text-white/25"
                />
                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => {
                    pendingExpense.current = row.id;
                    fileRef.current?.click();
                  }}
                  className="h-9 rounded-full bg-white/8 px-3 text-[12px] text-white/70"
                >
                  Adjuntar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("¿Borrar este gasto?")) {
                      void mutate(`/api/admin/finance/expenses/${row.id}`, { method: "DELETE" });
                    }
                  }}
                  className="h-9 rounded-full px-3 text-[12px] text-white/35 hover:text-red-200"
                >
                  Borrar
                </button>
                {busy === row.id ? <span className="text-[11px] text-white/35">Guardando…</span> : null}
              </div>

              {files.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {files.map((file) => (
                    <li key={file.id} className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => void openFile(file.id)}
                        className="text-[12px] text-white/75 hover:text-white"
                      >
                        {file.mime.includes("pdf") ? "PDF" : "Imagen"} · {file.name}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void mutate(`/api/admin/finance/files/${file.id}`, { method: "DELETE" })
                        }
                        className="text-[11px] text-white/35 hover:text-white"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[11px] text-white/28">{formatDay(row.date)}</p>
              )}
            </li>
          );
        })}
      </ul>

      {rows.length > 0 ? (
        <p className="mt-6 text-right text-sm text-white/45">
          En vista {formatFinanceMoney(rows.reduce((sum, row) => sum + row.amountCop, 0))}
        </p>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] ${
        active ? "bg-white text-[#0e0d14]" : "bg-white/8 text-white/60"
      }`}
    >
      {label}
    </button>
  );
}
