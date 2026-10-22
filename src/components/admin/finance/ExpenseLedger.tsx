"use client";

import { useEffect, useState } from "react";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_HINT,
  EXPENSE_CATEGORY_LABEL,
  formatDay,
  formatFinanceMoney,
  todayISO,
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

type Draft = {
  date: string;
  category: ExpenseCategory;
  title: string;
  vendor: string;
  amountCop: number;
  notes: string;
  file: File | null;
};

function emptyDraft(category: ExpenseCategory): Draft {
  return {
    date: todayISO(),
    category,
    title: "",
    vendor: "",
    amountCop: 0,
    notes: "",
    file: null,
  };
}

function draftFrom(expense: FinanceExpense): Draft {
  return {
    date: expense.date,
    category: expense.category,
    title: expense.title,
    vendor: expense.vendor,
    amountCop: expense.amountCop,
    notes: expense.notes,
    file: null,
  };
}

function filesFor(expense: FinanceExpense, attachments: FinanceAttachment[]) {
  return attachments.filter((file) => expense.attachmentIds.includes(file.id));
}

async function fileForUpload(file: File) {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) throw new Error("Solo PDF o imagen.");
  if (file.size > 8_000_000) throw new Error("El archivo pesa demasiado (máx. 8 MB).");
  if (isImage) {
    const dataUrl = await compressImage(file, 1600, 0.82);
    const blob = await fetch(dataUrl).then((res) => res.blob());
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  }
  return file;
}

export function ExpenseLedger({
  snapshot,
  mutate,
  openCreate = false,
  onCreateHandled,
}: {
  snapshot: FinanceSnapshot;
  mutate: FinanceMutator;
  openCreate?: boolean;
  onCreateHandled?: () => void;
}) {
  const { token } = useAdminAuth();
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<ExpenseCategory | "all">("all");
  const [editing, setEditing] = useState<FinanceExpense | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft("other"));

  const rows = snapshot.expenses.filter((row) => filter === "all" || row.category === filter);
  const editingFiles =
    editing && editing !== "new" ? filesFor(editing, snapshot.attachments) : [];

  useEffect(() => {
    if (!openCreate) return;
    setDraft(emptyDraft(filter === "all" ? "other" : filter));
    setEditing("new");
    setFormError("");
    onCreateHandled?.();
  }, [openCreate, filter, onCreateHandled]);

  function openNew() {
    setDraft(emptyDraft(filter === "all" ? "other" : filter));
    setFormError("");
    setEditing("new");
  }

  function openEdit(row: FinanceExpense) {
    setDraft(draftFrom(row));
    setFormError("");
    setEditing(row);
  }

  function closeForm() {
    if (busy) return;
    setEditing(null);
    setFormError("");
  }

  async function uploadFile(expenseId: string, file: File) {
    const ready = await fileForUpload(file);
    const form = new FormData();
    form.append("file", ready);
    form.append("expenseId", expenseId);
    await mutate("/api/admin/finance/files", { method: "POST", body: form });
  }

  async function save() {
    if (!draft.title.trim()) {
      setFormError("Ponle un nombre al egreso.");
      return;
    }
    if (!draft.amountCop) {
      setFormError("Pon el valor en pesos.");
      return;
    }
    setBusy(true);
    setFormError("");
    setError("");
    try {
      const body = {
        date: draft.date,
        category: draft.category,
        title: draft.title.trim(),
        vendor: draft.vendor.trim(),
        amountCop: draft.amountCop,
        notes: draft.notes,
      };
      if (editing === "new") {
        const previous = new Set(snapshot.expenses.map((row) => row.id));
        const next = await mutate("/api/admin/finance/expenses", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const created = next.expenses.find((row) => !previous.has(row.id));
        if (draft.file && created) await uploadFile(created.id, draft.file);
      } else if (editing) {
        await mutate(`/api/admin/finance/expenses/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        if (draft.file) await uploadFile(editing.id, draft.file);
      }
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
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

  return (
    <div className="frame-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl tracking-[-0.05em]">El libro.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
            Agrega un egreso, llena el flotante y guarda. El PDF se sube como archivo, no como texto.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
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

      <ul className="mt-8 space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-[1.5rem] bg-white/[0.04] px-5 py-8 text-sm text-white/40">
            Aquí va constitución, importación, anillos, marketing y lo de todos los días.
          </li>
        ) : null}
        {rows.map((row) => {
          const files = filesFor(row, snapshot.attachments);
          return (
            <li key={row.id} className="rounded-[1.5rem] bg-white/[0.04] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">
                    {formatDay(row.date)} · {EXPENSE_CATEGORY_LABEL[row.category]}
                  </p>
                  <p className="mt-2 text-[16px] tracking-[-0.02em]">
                    {row.title || "Sin nombre"}
                  </p>
                  <p className="mt-1 text-[13px] text-white/45">
                    {row.vendor || "Sin proveedor"}
                    {row.notes ? ` · ${row.notes}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl tracking-[-0.04em]">
                    {formatFinanceMoney(row.amountCop)}
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="h-9 rounded-full bg-white px-4 text-[12px] text-[#0e0d14]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("¿Borrar este gasto?")) {
                          void mutate(`/api/admin/finance/expenses/${row.id}`, {
                            method: "DELETE",
                          }).catch((err) =>
                            setError(err instanceof Error ? err.message : "No se pudo borrar."),
                          );
                        }
                      }}
                      className="h-9 rounded-full px-3 text-[12px] text-white/35 hover:text-red-200"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              </div>

              {files.length ? (
                <ul className="mt-4 flex flex-wrap gap-2">
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
              ) : null}
            </li>
          );
        })}
      </ul>

      {rows.length > 0 ? (
        <p className="mt-6 text-right text-sm text-white/45">
          En vista {formatFinanceMoney(rows.reduce((sum, row) => sum + row.amountCop, 0))}
        </p>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 sm:place-items-center sm:p-6">
          <form
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#16141f] p-6 sm:rounded-3xl sm:p-8"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Egreso</p>
                <h3 className="mt-1 text-2xl tracking-[-0.04em]">
                  {editing === "new" ? "Agregar" : "Editar"}
                </h3>
              </div>
              <button type="button" onClick={closeForm} className="text-sm text-white/50">
                Cerrar
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] uppercase tracking-[0.12em] text-white/40">
                Fecha
                <input
                  type="date"
                  required
                  value={draft.date}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, date: event.target.value }))
                  }
                  className={`mt-2 ${fieldClass}`}
                />
              </label>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-white/40">
                Tipo
                <select
                  value={draft.category}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      category: event.target.value as ExpenseCategory,
                    }))
                  }
                  className={`mt-2 ${fieldClass}`}
                >
                  {EXPENSE_CATEGORIES.map((key) => (
                    <option key={key} value={key}>
                      {EXPENSE_CATEGORY_LABEL[key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-white/40">
              Qué
              <input
                required
                value={draft.title}
                placeholder="Cámara de comercio, flete…"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                className={`mt-2 ${fieldClass}`}
              />
            </label>

            <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-white/40">
              A quién
              <input
                value={draft.vendor}
                placeholder="Proveedor o entidad"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, vendor: event.target.value }))
                }
                className={`mt-2 ${fieldClass}`}
              />
            </label>

            <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-white/40">
              COP
              <MoneyInput
                value={draft.amountCop}
                ariaLabel="Valor en pesos"
                onCommit={(amountCop) => setDraft((current) => ({ ...current, amountCop }))}
                className={`mt-2 ${fieldClass} text-right`}
              />
            </label>

            <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-white/40">
              Nota
              <input
                value={draft.notes}
                placeholder="Opcional"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
                className={`mt-2 ${fieldClass}`}
              />
            </label>

            <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-white/40">
              Factura o soporte
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setDraft((current) => ({ ...current, file }));
                }}
                className="mt-2 block w-full text-[13px] text-white/70 file:mr-3 file:h-9 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:text-[12px] file:text-white"
              />
              {draft.file ? (
                <p className="mt-2 text-[12px] text-white/50">
                  {draft.file.name} · {(draft.file.size / 1024).toFixed(0)} KB
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-white/35">PDF o foto, hasta 8 MB.</p>
              )}
            </label>

            {editingFiles.length ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {editingFiles.map((file) => (
                  <li key={file.id} className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => void openFile(file.id)}
                      className="text-[12px] text-white/75"
                    >
                      {file.mime.includes("pdf") ? "PDF" : "Imagen"} · {file.name}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void mutate(`/api/admin/finance/files/${file.id}`, { method: "DELETE" })
                      }
                      className="text-[11px] text-white/35"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {formError ? <p className="mt-4 text-sm text-red-300">{formError}</p> : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 h-11 w-full rounded-full bg-white text-[13px] text-[#16141f] disabled:opacity-40"
            >
              {busy ? "Guardando…" : editing === "new" ? "Guardar egreso" : "Guardar cambios"}
            </button>
          </form>
        </div>
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
