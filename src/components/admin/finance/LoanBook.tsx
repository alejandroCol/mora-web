"use client";

import { useMemo, useState } from "react";
import {
  buildLoanSchedule,
  currentMonthKey,
  DEFAULT_LOAN_TERMS,
  formatDay,
  formatFinanceMoney,
  formatMonthTitle,
  loanMonthlyAmount,
  loanOutstanding,
  loanTotalDue,
  todayISO,
  type FinanceLoan,
  type LoanDraft,
} from "@/commerce/finance";
import { MoneyInput } from "./moneyInput";
import type { FinanceMutator, FinanceSnapshot } from "./types";

const fieldClass =
  "h-11 w-full rounded-2xl bg-white/8 px-3 text-[16px] normal-case tracking-normal text-white";

const emptyDraft = (): LoanDraft => ({
  lender: "",
  principal: 0,
  disbursedAt: todayISO(),
  installmentCount: DEFAULT_LOAN_TERMS.installmentCount,
  graceMonths: DEFAULT_LOAN_TERMS.graceMonths,
  totalInterestRate: DEFAULT_LOAN_TERMS.totalInterestRate,
  notes: "",
});

export function LoanBook({
  snapshot,
  mutate,
}: {
  snapshot: FinanceSnapshot;
  mutate: FinanceMutator;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<LoanDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const month = currentMonthKey();

  const preview = useMemo(
    () =>
      buildLoanSchedule({
        principal: draft.principal,
        disbursedAt: draft.disbursedAt,
        installmentCount: draft.installmentCount,
        graceMonths: draft.graceMonths,
        totalInterestRate: draft.totalInterestRate,
      }),
    [draft],
  );
  const cuota = preview[0]?.amount ?? 0;
  const total = loanTotalDue(draft.principal, draft.totalInterestRate ?? DEFAULT_LOAN_TERMS.totalInterestRate);

  function startCreate() {
    setEditing(null);
    setDraft(emptyDraft());
    setError("");
    setOpen(true);
  }

  function startEdit(loan: FinanceLoan) {
    setEditing(loan.id);
    setDraft({
      lender: loan.lender,
      principal: loan.principal,
      disbursedAt: loan.disbursedAt,
      installmentCount: loan.installmentCount,
      graceMonths: loan.graceMonths,
      totalInterestRate: loan.totalInterestRate,
      notes: loan.notes,
    });
    setError("");
    setOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await mutate(`/api/admin/finance/loans/${editing}`, {
          method: "PATCH",
          body: JSON.stringify(draft),
        });
      } else {
        await mutate("/api/admin/finance/loans", {
          method: "POST",
          body: JSON.stringify(draft),
        });
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="frame-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl tracking-[-0.05em]">Quién te prestó.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
            20% de interés total, 12 cuotas, la primera a los dos meses del desembolso. Al cierre
            de mes marcas pagada la de cada persona.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="h-10 rounded-full bg-white px-5 text-[13px] text-[#0e0d14]"
        >
          Registrar préstamo
        </button>
      </div>

      <p className="mt-8 text-[11px] uppercase tracking-[0.14em] text-white/35">
        {formatMonthTitle(month)}
      </p>

      <ul className="mt-6 space-y-4">
        {snapshot.loans.length === 0 ? (
          <li className="rounded-[1.5rem] bg-white/[0.04] px-5 py-8 text-sm text-white/40">
            Mamá, un socio, un amigo. Cada uno con su fecha y su cuota.
          </li>
        ) : null}
        {snapshot.loans.map((loan) => {
          const outstanding = loanOutstanding(loan);
          const paid = loan.installments.filter((row) => row.paidAt).length;
          const thisMonth = loan.installments.find((row) => row.dueDate.startsWith(month));
          return (
            <li key={loan.id} className="rounded-[1.6rem] bg-white/[0.04] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[18px] tracking-[-0.03em]">{loan.lender}</p>
                  <p className="mt-1 text-[13px] text-white/45">
                    {formatFinanceMoney(loan.principal)} el {formatDay(loan.disbursedAt)} · a devolver{" "}
                    {formatFinanceMoney(loanTotalDue(loan.principal, loan.totalInterestRate))}
                  </p>
                  <p className="mt-1 text-[12px] text-white/35">
                    {loan.installmentCount} cuotas de {formatFinanceMoney(loanMonthlyAmount(loan))} ·
                    primera {formatDay(loan.installments[0]?.dueDate ?? loan.disbursedAt)} · viven{" "}
                    {formatFinanceMoney(outstanding)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {thisMonth ? (
                    <button
                      type="button"
                      onClick={() =>
                        void mutate(`/api/admin/finance/loans/${loan.id}/installments`, {
                          method: "PATCH",
                          body: JSON.stringify({
                            number: thisMonth.number,
                            paid: !thisMonth.paidAt,
                          }),
                        })
                      }
                      className={`h-10 rounded-full px-4 text-[12px] ${
                        thisMonth.paidAt ? "bg-emerald-300/15 text-emerald-200" : "bg-white text-[#0e0d14]"
                      }`}
                    >
                      {thisMonth.paidAt ? "Cuota del mes pagada" : "Marcar cuota del mes"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => startEdit(loan)}
                    className="h-10 rounded-full bg-white/8 px-4 text-[12px] text-white/60"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Borrar el préstamo de ${loan.lender}?`)) {
                        void mutate(`/api/admin/finance/loans/${loan.id}`, { method: "DELETE" });
                      }
                    }}
                    className="h-10 rounded-full px-3 text-[12px] text-white/30 hover:text-red-200"
                  >
                    Borrar
                  </button>
                </div>
              </div>

              <ol className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {loan.installments.map((row) => {
                  const isMonth = row.dueDate.startsWith(month);
                  return (
                    <li key={row.number}>
                      <button
                        type="button"
                        onClick={() =>
                          void mutate(`/api/admin/finance/loans/${loan.id}/installments`, {
                            method: "PATCH",
                            body: JSON.stringify({ number: row.number, paid: !row.paidAt }),
                          })
                        }
                        className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left ${
                          row.paidAt
                            ? "bg-emerald-300/10 text-emerald-100"
                            : isMonth
                              ? "bg-white text-[#0e0d14]"
                              : "bg-white/6 text-white/70"
                        }`}
                      >
                        <span className="text-[12px]">
                          {row.number}/{loan.installmentCount} · {formatDay(row.dueDate)}
                        </span>
                        <span className="text-[12px]">
                          {row.paidAt ? "Pagada" : formatFinanceMoney(row.amount)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              {loan.notes ? <p className="mt-4 text-[12px] text-white/35">{loan.notes}</p> : null}
              <p className="mt-3 text-[11px] text-white/28">
                {paid} de {loan.installmentCount} pagadas
              </p>
            </li>
          );
        })}
      </ul>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 sm:place-items-center sm:p-6">
          <form
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#16141f] p-6 sm:rounded-3xl sm:p-8"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Préstamo</p>
                <h3 className="mt-1 text-2xl tracking-[-0.04em]">
                  {editing ? "Ajustar" : "Registrar"}
                </h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-white/50">
                Cerrar
              </button>
            </div>

            <label className="mt-6 block text-[11px] uppercase tracking-[0.12em] text-white/40">
              Quién
              <input
                required
                value={draft.lender}
                onChange={(event) => setDraft((current) => ({ ...current, lender: event.target.value }))}
                className={`mt-2 ${fieldClass}`}
              />
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] uppercase tracking-[0.12em] text-white/40">
                Cuánto
                <MoneyInput
                  value={draft.principal}
                  ariaLabel="Capital"
                  onCommit={(principal) => setDraft((current) => ({ ...current, principal }))}
                  className={`mt-2 ${fieldClass}`}
                />
              </label>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-white/40">
                Desembolso
                <input
                  type="date"
                  required
                  value={draft.disbursedAt}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, disbursedAt: event.target.value }))
                  }
                  className={`mt-2 ${fieldClass}`}
                />
              </label>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <label className="block text-[11px] uppercase tracking-[0.12em] text-white/40">
                Cuotas
                <input
                  type="number"
                  min={1}
                  value={draft.installmentCount}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      installmentCount: Number(event.target.value) || 1,
                    }))
                  }
                  className={`mt-2 ${fieldClass}`}
                />
              </label>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-white/40">
                Espera
                <input
                  type="number"
                  min={0}
                  value={draft.graceMonths}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      graceMonths: Number(event.target.value) || 0,
                    }))
                  }
                  className={`mt-2 ${fieldClass}`}
                />
              </label>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-white/40">
                Interés
                <input
                  inputMode="decimal"
                  value={Math.round((draft.totalInterestRate ?? 0) * 100)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      totalInterestRate: (Number(event.target.value) || 0) / 100,
                    }))
                  }
                  className={`mt-2 ${fieldClass}`}
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-white/30">
              Espera en meses. Interés total, no anual. 20 = 20%.
            </p>
            <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-white/40">
              Nota
              <input
                value={draft.notes ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                className={`mt-2 ${fieldClass}`}
              />
            </label>

            <div className="mt-6 rounded-2xl bg-white/[0.05] p-4">
              <p className="text-[12px] text-white/45">Así queda</p>
              <p className="mt-2 text-[16px]">
                {formatFinanceMoney(cuota)} al mes · {formatFinanceMoney(total)} en total
              </p>
              {preview[0] ? (
                <p className="mt-1 text-[12px] text-white/40">
                  Primera cuota el {formatDay(preview[0].dueDate)}
                </p>
              ) : null}
            </div>

            {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-6 h-11 w-full rounded-full bg-white text-[13px] text-[#16141f] disabled:opacity-40"
            >
              {busy ? "Guardando…" : editing ? "Guardar cambios" : "Crear préstamo"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
