import {
  currentMonthKey,
  dueInstallmentsInMonth,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  expenseCountsTowardTotal,
  formatDay,
  formatFinanceMoney,
  formatMonthTitle,
  loanOutstanding,
  nextUnpaidInstallment,
  purchaseTotals,
  spentByCategory,
  type FinanceLoan,
} from "@/commerce/finance";
import type { FinanceMutator, FinanceSnapshot } from "./types";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-[1.5rem] bg-white/[0.04] px-5 py-5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-3 font-display text-3xl tracking-[-0.05em]">{value}</p>
      {hint ? <p className="mt-2 text-[12px] leading-5 text-white/40">{hint}</p> : null}
    </article>
  );
}

export function FinanceOverview({
  snapshot,
  mutate,
  onOpen,
}: {
  snapshot: FinanceSnapshot;
  mutate: FinanceMutator;
  onOpen: (tab: "gastos" | "pedido" | "prestamos") => void;
}) {
  const spent = snapshot.expenses
    .filter(expenseCountsTowardTotal)
    .reduce((sum, row) => sum + row.amountCop, 0);
  const byCategory = spentByCategory(snapshot.expenses);
  const maxCategory = Math.max(1, ...EXPENSE_CATEGORIES.map((key) => byCategory[key]));
  const debt = snapshot.loans.reduce((sum, loan) => sum + loanOutstanding(loan), 0);
  const lent = snapshot.loans.reduce((sum, loan) => sum + loan.principal, 0);
  const month = currentMonthKey();
  const dues = dueInstallmentsInMonth(snapshot.loans, month);
  const pendingDues = dues.filter((row) => !row.installment.paidAt);
  const next = snapshot.loans
    .map((loan) => {
      const installment = nextUnpaidInstallment(loan);
      return installment ? { loan, installment } : null;
    })
    .filter((row): row is { loan: FinanceLoan; installment: NonNullable<ReturnType<typeof nextUnpaidInstallment>> } =>
      Boolean(row),
    )
    .sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate))[0];
  const orderHint = snapshot.orders[0]
    ? `${snapshot.orders[0].title} · ${formatFinanceMoney(purchaseTotals(snapshot.orders[0]).totalCop)}`
    : "Aún no armaste el primer pedido.";

  return (
    <div className="frame-in">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Gastado" value={formatFinanceMoney(spent)} hint="Todo lo anotado en el libro." />
        <Stat
          label="Te prestaron"
          value={formatFinanceMoney(lent)}
          hint={lent ? `Vivo ${formatFinanceMoney(debt)}` : "Cuando alguien te gire, queda aquí."}
        />
        <Stat
          label="Este mes"
          value={
            pendingDues.length
              ? formatFinanceMoney(pendingDues.reduce((sum, row) => sum + row.installment.amount, 0))
              : "Al día"
          }
          hint={
            pendingDues.length
              ? `${pendingDues.length} cuota${pendingDues.length === 1 ? "" : "s"} de ${formatMonthTitle(month)}`
              : formatMonthTitle(month)
          }
        />
        <Stat
          label="Siguiente cuota"
          value={next ? formatFinanceMoney(next.installment.amount) : "—"}
          hint={next ? `${next.loan.lender} · ${formatDay(next.installment.dueDate)}` : "Sin cuotas pendientes."}
        />
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[1.6rem] bg-white/[0.04] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px]">A dónde se fue</h2>
              <p className="mt-1 text-[12px] text-white/40">Constitución, importación, anillos y el resto.</p>
            </div>
            <button type="button" onClick={() => onOpen("gastos")} className="text-[12px] text-white/45 hover:text-white">
              Libro
            </button>
          </div>
          <ul className="mt-6 space-y-4">
            {EXPENSE_CATEGORIES.map((key) => (
              <li key={key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{EXPENSE_CATEGORY_LABEL[key]}</span>
                  <span className="text-white/45">{formatFinanceMoney(byCategory[key])}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${(byCategory[key] / maxCategory) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col rounded-[1.6rem] bg-white/[0.04] p-5">
          <h2 className="text-[15px]">Cierre del mes</h2>
          <p className="mt-1 text-[12px] text-white/40">
            Marca la cuota de quien te prestó. Se puede deshacer.
          </p>
          <ul className="mt-5 space-y-3">
            {dues.length === 0 ? (
              <li className="text-sm text-white/40">Este mes no cae ninguna cuota.</li>
            ) : (
              dues.map(({ loan, installment }) => (
                <li
                  key={`${loan.id}-${installment.number}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-3 py-3"
                >
                  <div>
                    <p className="text-sm">{loan.lender}</p>
                    <p className="text-[12px] text-white/40">
                      Cuota {installment.number} · {formatFinanceMoney(installment.amount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void mutate(`/api/admin/finance/loans/${loan.id}/installments`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          number: installment.number,
                          paid: !installment.paidAt,
                        }),
                      })
                    }
                    className={`h-9 rounded-full px-3 text-[12px] ${
                      installment.paidAt ? "bg-emerald-300/15 text-emerald-200" : "bg-white text-[#0e0d14]"
                    }`}
                  >
                    {installment.paidAt ? "Pagada" : "Marcar"}
                  </button>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            onClick={() => onOpen("prestamos")}
            className="mt-auto pt-5 text-left text-[12px] text-white/45 hover:text-white"
          >
            Ver todos los préstamos
          </button>
        </section>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onOpen("pedido")}
          className="rounded-[1.5rem] bg-white/[0.04] p-5 text-left"
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">Primer pedido</p>
          <p className="mt-2 text-[16px] tracking-[-0.02em]">Anillos, forros y cargadores.</p>
          <p className="mt-2 text-[13px] text-white/40">{orderHint}</p>
        </button>
        <button
          type="button"
          onClick={() => onOpen("gastos")}
          className="rounded-[1.5rem] bg-white/[0.04] p-5 text-left"
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">Anotar</p>
          <p className="mt-2 text-[16px] tracking-[-0.02em]">Un gasto, con factura si quieres.</p>
          <p className="mt-2 text-[13px] text-white/40">Se guarda al salir de cada campo.</p>
        </button>
      </div>
    </div>
  );
}
