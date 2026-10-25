"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  currentMonthKey,
  formatFinanceMoney,
  formatMonthTitle,
} from "@/commerce/finance";
import { PAYMENT_METHOD_LABEL } from "@/commerce/labels";
import {
  newCustomLine,
  RING_FEE_METHODS,
  RING_MODEL_IDS,
  type IvaMode,
  type RingCostLine,
  type RingModelConfig,
  type RingsEconomicsConfig,
  type RingsEconomicsSnapshot,
} from "@/commerce/rings";
import type { ModelId } from "@/lib/catalog";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { MoneyInput, parseLooseNumber } from "../finance/moneyInput";
import { useAdminAuth } from "../AdminAuth";

const fieldClass =
  "h-10 w-full rounded-2xl bg-white/8 px-3 text-[13px] text-white placeholder:text-white/25";

function monthChoices() {
  const now = currentMonthKey();
  const [year, month] = now.split("-").map(Number);
  const items = [{ id: "all", label: "Todo" }];
  for (let index = 0; index < 6; index += 1) {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    items.push({ id: key, label: formatMonthTitle(key) });
  }
  return items;
}

function formatPct(value: number) {
  const n = Number.isFinite(value) ? value * 100 : 0;
  return `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
}

function OptionalNumberInput({
  value,
  decimals = 0,
  placeholder,
  onCommit,
  className,
  ariaLabel,
}: {
  value: number | null;
  decimals?: number;
  placeholder?: string;
  onCommit: (value: number | null) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      defaultValue={value === null ? "" : String(value)}
      key={`${value}-${decimals}`}
      placeholder={placeholder}
      onBlur={(event) => {
        const raw = event.target.value.trim();
        if (!raw) {
          if (value !== null) onCommit(null);
          return;
        }
        const next = parseLooseNumber(raw, decimals);
        if (next !== value) onCommit(next);
        event.target.value = String(next);
      }}
      className={className}
    />
  );
}

export function MisAnillosView() {
  const { authorizedFetch } = useAdminAuth();
  const [month, setMonth] = useState("all");
  const [snapshot, setSnapshot] = useState<RingsEconomicsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const months = useMemo(() => monthChoices(), []);

  const apply = useCallback((data: Partial<RingsEconomicsSnapshot> & { ok?: boolean; error?: string }) => {
    if (data.ok === false) throw new Error(data.error || "No se pudo guardar.");
    if (!data.config || !data.models) throw new Error("Respuesta incompleta.");
    setSnapshot(data as RingsEconomicsSnapshot);
    return data as RingsEconomicsSnapshot;
  }, []);

  const load = useCallback(
    async (nextMonth: string) => {
      const res = await authorizedFetch(`/api/admin/rings?month=${nextMonth}`);
      const data = (await res.json()) as Partial<RingsEconomicsSnapshot> & { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo abrir.");
      apply(data);
    },
    [authorizedFetch, apply],
  );

  const save = useCallback(
    async (config: RingsEconomicsConfig, nextMonth = month) => {
      setSaving(true);
      setError("");
      try {
        const res = await authorizedFetch("/api/admin/rings", {
          method: "PUT",
          body: JSON.stringify({ month: nextMonth, config }),
        });
        const data = (await res.json()) as Partial<RingsEconomicsSnapshot> & { ok?: boolean; error?: string };
        if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo guardar.");
        apply(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar.");
      } finally {
        setSaving(false);
      }
    },
    [authorizedFetch, apply, month],
  );

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same mount fetch as PresupuestoView
    void load(month)
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "No se pudo abrir.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [load, month]);

  function patchConfig(next: RingsEconomicsConfig) {
    if (!snapshot) return;
    setSnapshot({ ...snapshot, config: next });
    void save(next);
  }

  function patchModel(modelId: ModelId, patch: Partial<RingModelConfig>) {
    if (!snapshot) return;
    patchConfig({
      ...snapshot.config,
      models: {
        ...snapshot.config.models,
        [modelId]: { ...snapshot.config.models[modelId], ...patch },
      },
    });
  }

  function patchLine(modelId: ModelId, lineId: string, patch: Partial<RingCostLine>) {
    if (!snapshot) return;
    patchModel(modelId, {
      lines: snapshot.config.models[modelId].lines.map((row) =>
        row.id === lineId ? { ...row, ...patch } : row,
      ),
    });
  }

  if (loading && !snapshot) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <BrandLoader label="Abriendo tus anillos" />
      </div>
    );
  }

  if (!snapshot) {
    return <p className="mt-6 text-sm text-red-300">{error || "No se pudo abrir."}</p>;
  }

  const houseProfit = RING_MODEL_IDS.reduce((sum, id) => sum + snapshot.models[id].profitOnSold, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Mis anillos</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">Pro y Ultra, en números.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
            El CAC sale del marketing del presupuesto y de los anillos vendidos. El resto lo
            anotas tú: costo, envío, comisión, IVA y lo que falte.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saving ? <span className="text-[12px] text-white/35">Guardando…</span> : null}
          <nav className="flex flex-wrap gap-1 rounded-full bg-white/6 p-1">
            {months.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMonth(item.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] ${
                  month === item.id ? "bg-white text-[#0e0d14]" : "text-white/55 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {error ? <p className="mt-6 text-sm text-red-300">{error}</p> : null}

      <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Marketing"
          value={formatFinanceMoney(snapshot.marketingSpend)}
          hint="Lo anotado en Presupuesto."
        />
        <Stat
          label="Vendidos"
          value={String(snapshot.sold)}
          hint={
            snapshot.ordersSold
              ? `${snapshot.ordersSold} pedido${snapshot.ordersSold === 1 ? "" : "s"} pagos`
              : "Aún no hay un pedido pago."
          }
        />
        <Stat
          label="CAC"
          value={snapshot.cac === null ? "—" : formatFinanceMoney(snapshot.cac)}
          hint={
            snapshot.cac === null
              ? "Aparece con el primer anillo vendido."
              : snapshot.cacPerOrder !== null
                ? `Por pedido ${formatFinanceMoney(snapshot.cacPerOrder)}`
                : "Marketing ÷ anillos."
          }
        />
        <Stat
          label="Deja en lo vendido"
          value={snapshot.sold ? formatFinanceMoney(houseProfit) : "—"}
          hint={snapshot.sold ? "Después de todos los costos." : "Cuando vendas, se multiplica."}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {RING_MODEL_IDS.map((modelId) => (
          <ModelCard
            key={modelId}
            modelId={modelId}
            snapshot={snapshot}
            onSalePrice={(salePrice) => patchModel(modelId, { salePrice, useActualPrice: false })}
            onUseActual={(useActualPrice) => patchModel(modelId, { useActualPrice })}
            onLine={(lineId, patch) => patchLine(modelId, lineId, patch)}
            onAdd={() =>
              patchModel(modelId, {
                lines: [...snapshot.config.models[modelId].lines, newCustomLine()],
              })
            }
            onRemove={(lineId) =>
              patchModel(modelId, {
                lines: snapshot.config.models[modelId].lines.filter((row) => row.id !== lineId),
              })
            }
          />
        ))}
      </div>

      <SharedSettings
        config={snapshot.config}
        mix={snapshot.paymentMix}
        onIva={(ivaMode) => patchConfig({ ...snapshot.config, ivaMode })}
        onFee={(method, amount) =>
          patchConfig({
            ...snapshot.config,
            paymentFees: { ...snapshot.config.paymentFees, [method]: amount },
          })
        }
      />
    </div>
  );
}

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

function ModelCard({
  modelId,
  snapshot,
  onSalePrice,
  onUseActual,
  onLine,
  onAdd,
  onRemove,
}: {
  modelId: ModelId;
  snapshot: RingsEconomicsSnapshot;
  onSalePrice: (value: number) => void;
  onUseActual: (value: boolean) => void;
  onLine: (lineId: string, patch: Partial<RingCostLine>) => void;
  onAdd: () => void;
  onRemove: (lineId: string) => void;
}) {
  const model = snapshot.models[modelId];
  const config = snapshot.config.models[modelId];
  const profitTone = model.profit > 0 ? "text-emerald-200" : model.profit < 0 ? "text-red-300" : "text-white/70";

  return (
    <section className="rounded-[1.6rem] bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">Mora</p>
          <h2 className="mt-1 font-display text-3xl tracking-[-0.05em]">{model.name}</h2>
          <p className="mt-2 text-[13px] text-white/45">
            {model.sold
              ? `${model.sold} vendido${model.sold === 1 ? "" : "s"} · medio ${formatFinanceMoney(model.avgPrice)}`
              : "Todavía no se ha vendido uno."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">Deja</p>
          <p className={`mt-1 font-display text-2xl tracking-[-0.04em] ${profitTone}`}>
            {formatFinanceMoney(model.profit)}
          </p>
          <p className="mt-1 text-[12px] text-white/40">{formatPct(model.margin)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/35">Precio de venta</span>
          <MoneyInput
            value={config.salePrice}
            ariaLabel={`Precio Mora ${model.name}`}
            onCommit={onSalePrice}
            className={`${fieldClass} mt-2`}
          />
        </label>
        <button
          type="button"
          disabled={!model.avgPrice}
          onClick={() => onUseActual(!config.useActualPrice)}
          className={`h-10 rounded-full px-4 text-[12px] ${
            config.useActualPrice ? "bg-white text-[#0e0d14]" : "bg-white/8 text-white/70"
          } disabled:opacity-40`}
        >
          {config.useActualPrice ? "Usando el medio real" : "Usar el medio vendido"}
        </button>
      </div>

      <ul className="mt-6 space-y-2">
        {model.lines.map((row) => (
          <CostRow
            key={row.line.id}
            row={row}
            cacUnknown={snapshot.cac === null}
            onPatch={(patch) => onLine(row.line.id, patch)}
            onRemove={row.line.key === "custom" ? () => onRemove(row.line.id) : undefined}
          />
        ))}
      </ul>

      <button type="button" onClick={onAdd} className="mt-4 text-[12px] text-white/45 hover:text-white">
        Añadir un costo
      </button>

      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/8 pt-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">Costo total</p>
          <p className="mt-1 text-[16px]">{formatFinanceMoney(model.costTotal)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">En lo vendido</p>
          <p className={`mt-1 text-[16px] ${profitTone}`}>
            {model.sold ? formatFinanceMoney(model.profitOnSold) : "—"}
          </p>
        </div>
      </div>
    </section>
  );
}

function CostRow({
  row,
  cacUnknown,
  onPatch,
  onRemove,
}: {
  row: RingsEconomicsSnapshot["models"][ModelId]["lines"][number];
  cacUnknown: boolean;
  onPatch: (patch: Partial<RingCostLine>) => void;
  onRemove?: () => void;
}) {
  const { line, cost, hint } = row;
  const locked = line.key === "cac";
  const percent = line.kind === "percent";
  const shown = locked && cacUnknown ? "—" : formatFinanceMoney(cost);

  return (
    <li className={`rounded-2xl bg-white/[0.04] px-3 py-3 ${line.enabled ? "" : "opacity-45"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label={line.enabled ? "No restar" : "Restar"}
          onClick={() => onPatch({ enabled: !line.enabled })}
          className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
            line.enabled ? "bg-white text-[#0e0d14]" : "bg-white/10 text-white/50"
          }`}
        >
          {line.enabled ? "−" : "+"}
        </button>
        {line.key === "custom" ? (
          <input
            defaultValue={line.label}
            key={line.label}
            onBlur={(event) => {
              const next = event.target.value.trim() || "Otro";
              if (next !== line.label) onPatch({ label: next });
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        ) : (
          <p className="min-w-0 flex-1 text-[13px]">{line.label}</p>
        )}
        {line.key === "custom" ? (
          <button
            type="button"
            onClick={() => onPatch({ kind: percent ? "fixed" : "percent" })}
            className="rounded-full bg-white/8 px-2 py-1 text-[11px] text-white/55"
          >
            {percent ? "%" : "$"}
          </button>
        ) : null}
        {locked ? (
          <p className="w-[7.5rem] text-right text-[13px] text-white/70">{shown}</p>
        ) : line.key === "payment_fee" ? (
          <OptionalNumberInput
            value={line.amount}
            decimals={2}
            placeholder="auto"
            ariaLabel={line.label}
            onCommit={(amount) => onPatch({ amount })}
            className={`${fieldClass} w-[7.5rem] text-right`}
          />
        ) : percent ? (
          <MoneyInput
            value={line.amount ?? 0}
            decimals={2}
            ariaLabel={line.label}
            onCommit={(amount) => onPatch({ amount })}
            className={`${fieldClass} w-[7.5rem] text-right`}
          />
        ) : line.key === "unit_cost" ? (
          <OptionalNumberInput
            value={line.amount}
            placeholder="auto"
            ariaLabel={line.label}
            onCommit={(amount) => onPatch({ amount })}
            className={`${fieldClass} w-[7.5rem] text-right`}
          />
        ) : (
          <MoneyInput
            value={line.amount ?? 0}
            ariaLabel={line.label}
            onCommit={(amount) => onPatch({ amount })}
            className={`${fieldClass} w-[7.5rem] text-right`}
          />
        )}
        {onRemove ? (
          <button type="button" onClick={onRemove} className="text-[11px] text-white/35 hover:text-white">
            Quitar
          </button>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 pl-8 text-[12px] text-white/35">
        <span>{hint}</span>
        <span>{shown}</span>
      </div>
    </li>
  );
}

function SharedSettings({
  config,
  mix,
  onIva,
  onFee,
}: {
  config: RingsEconomicsConfig;
  mix: RingsEconomicsSnapshot["paymentMix"];
  onIva: (mode: IvaMode) => void;
  onFee: (method: (typeof RING_FEE_METHODS)[number], amount: number) => void;
}) {
  return (
    <section className="mt-4 rounded-[1.6rem] bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px]">Cómo se resta</h2>
          <p className="mt-1 text-[12px] text-white/40">
            El IVA y la comisión valen para los dos anillos. Vacío en comisión usa el mix de
            lo vendido.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-white/6 p-1">
          {(
            [
              { id: "included", label: "IVA incluido" },
              { id: "added", label: "IVA encima" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onIva(item.id)}
              className={`rounded-full px-3 py-1.5 text-[12px] ${
                config.ivaMode === item.id ? "bg-white text-[#0e0d14]" : "text-white/55 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {RING_FEE_METHODS.map((method) => {
          const used = mix.find((row) => row.method === method);
          return (
            <li key={method} className="rounded-2xl bg-white/[0.04] px-3 py-3">
              <p className="text-[13px]">{PAYMENT_METHOD_LABEL[method]}</p>
              <MoneyInput
                value={config.paymentFees[method]}
                decimals={2}
                ariaLabel={`Comisión ${method}`}
                onCommit={(amount) => onFee(method, amount)}
                className={`${fieldClass} mt-2`}
              />
              <p className="mt-2 text-[11px] text-white/35">
                {used?.rings
                  ? `${used.rings} anillo${used.rings === 1 ? "" : "s"} por este medio`
                  : "Aprox. % por cobro"}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
