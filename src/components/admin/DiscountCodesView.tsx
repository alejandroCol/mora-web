"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  DISCOUNT_STATUS_LABEL,
  discountCheckoutPath,
  discountCodeRemaining,
  discountCodeStatus,
  discountValueLabel,
  normalizeDiscountCode,
  type DiscountCode,
  type DiscountCodeStatus,
} from "@/commerce/discounts";
import type { CartOfferKind } from "@/commerce/types";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { formatMoney } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import { useAdminAuth } from "./AdminAuth";

type Filter = "all" | DiscountCodeStatus;

type ListResponse = { ok?: boolean; error?: string; codes?: DiscountCode[] };

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function ago(at: number) {
  if (!at) return "";
  const diff = Math.max(0, Date.now() - at);
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

export function DiscountCodesView() {
  const { authorizedFetch } = useAdminAuth();
  const [codes, setCodes] = useState<DiscountCode[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const load = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/discounts");
    const data = (await res.json()) as ListResponse;
    if (!res.ok || data.ok === false) {
      setError(data.error || "No se pudieron leer los códigos.");
      setCodes([]);
      return;
    }
    setCodes(data.codes ?? []);
  }, [authorizedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const list = codes ?? [];
    const active = list.filter((c) => discountCodeStatus(c) === "active").length;
    const exhausted = list.filter((c) => discountCodeStatus(c) === "exhausted").length;
    const uses = list.reduce((sum, c) => sum + c.uses, 0);
    const pending = list.reduce((sum, c) => sum + c.pending, 0);
    return { active, exhausted, uses, pending, total: list.length };
  }, [codes]);

  const filtered = useMemo(() => {
    const q = normalizeDiscountCode(query);
    return (codes ?? []).filter((code) => {
      if (filter !== "all" && discountCodeStatus(code) !== filter) return false;
      if (!q) return true;
      return code.code.includes(q) || (code.note ?? "").toUpperCase().includes(q);
    });
  }, [codes, filter, query]);

  async function mutate(
    key: string,
    input: RequestInfo,
    init: RequestInit,
    done?: string,
  ) {
    setBusy(key);
    setError("");
    try {
      const res = await authorizedFetch(input, init);
      const data = (await res.json()) as ListResponse;
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo guardar.");
      if (data.codes) setCodes(data.codes);
      else await load();
      if (done) flash(done);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function toggle(code: DiscountCode) {
    void mutate(
      code.code,
      `/api/admin/discounts/${encodeURIComponent(code.code)}`,
      { method: "PATCH", body: JSON.stringify({ active: !code.active }) },
      code.active ? `${code.code} en pausa.` : `${code.code} activo.`,
    );
  }

  function remove(code: DiscountCode) {
    const used = code.uses > 0 ? ` Ya se usó ${code.uses} ${code.uses === 1 ? "vez" : "veces"}.` : "";
    if (!window.confirm(`¿Borrar ${code.code}?${used} No se puede deshacer.`)) return;
    void mutate(
      code.code,
      `/api/admin/discounts/${encodeURIComponent(code.code)}`,
      { method: "DELETE" },
      `${code.code} borrado.`,
    );
  }

  async function copyLink(code: DiscountCode) {
    const url = siteUrl(discountCheckoutPath(code.code));
    try {
      await navigator.clipboard.writeText(url);
      flash("Enlace copiado.");
    } catch {
      flash(url);
    }
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "active", label: "Activos" },
    { id: "paused", label: "Pausados" },
    { id: "exhausted", label: "Agotados" },
  ];

  return (
    <div className="ventas-app">
      <header>
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Operación</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">Códigos de descuento.</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
          Un porcentaje o un valor en pesos sobre el subtotal. El cliente lo escribe al pagar;
          cada pedido pagado cuenta un uso y los checkouts abiertos apartan cupo.
        </p>
      </header>

      <div className="ventas-kpis">
        <Kpi label="Activos" value={String(stats.active)} hint={`${stats.total} en total`} />
        <Kpi label="Usos" value={String(stats.uses)} hint="Pedidos pagados" />
        <Kpi label="En checkout" value={String(stats.pending)} hint="Cupo apartado" />
        <Kpi label="Agotados" value={String(stats.exhausted)} hint="Llegaron al límite" />
      </div>

      <CreateCodeCard
        busy={busy === "create"}
        onCreate={(body) =>
          mutate(
            "create",
            "/api/admin/discounts",
            { method: "POST", body: JSON.stringify(body) },
            `${normalizeDiscountCode(body.code)} creado.`,
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-3 py-1.5 text-[12px] ${
              filter === item.id ? "bg-[#1d1d1f] text-white" : "bg-white/8 text-white/55"
            }`}
          >
            {item.label}
          </button>
        ))}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar código o nota"
          className="ml-auto h-10 w-full max-w-xs rounded-full bg-white/8 px-4 text-[13px] outline-none"
        />
      </div>

      {error ? <p className="text-[13px] text-[var(--admin-danger)]">{error}</p> : null}

      {codes === null ? (
        <div className="grid min-h-[20vh] place-items-center">
          <BrandLoader label="Cargando códigos" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-[1.25rem] bg-white px-5 py-8 text-[14px] text-[var(--admin-muted)] shadow-[var(--admin-shadow)]">
          {codes.length === 0
            ? "Aún no hay códigos. Crea el primero arriba."
            : "Nada en este filtro."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((code) => {
            const status = discountCodeStatus(code);
            const left = discountCodeRemaining(code);
            const working = busy === code.code;
            return (
              <li key={code.code} className="ventas-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[15px] font-medium tracking-[0.04em]">
                        {code.code}
                      </p>
                      <StatusChip status={status} />
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--admin-muted)]">
                      {code.kind === "percent"
                        ? `${code.value} % de descuento`
                        : `${formatMoney(code.value)} de descuento`}
                      {code.note ? ` · ${code.note}` : ""}
                    </p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                      {code.maxUses == null
                        ? `${code.uses} ${code.uses === 1 ? "uso" : "usos"} · sin límite`
                        : `${code.uses} de ${code.maxUses} usos · quedan ${left}`}
                      {code.pending > 0
                        ? ` · ${code.pending} en checkout`
                        : ""}
                      {code.createdAt ? ` · creado ${ago(code.createdAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-start gap-4 text-right">
                    <p className="text-[22px] font-semibold tracking-[-0.03em]">
                      {discountValueLabel(code)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => toggle(code)}
                    className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px] disabled:opacity-40"
                  >
                    {code.active ? "Pausar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyLink(code)}
                    className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px]"
                  >
                    Copiar enlace
                  </button>
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => remove(code)}
                    className="ml-auto h-9 rounded-full px-4 text-[12px] text-[var(--admin-danger)] hover:bg-red-50 disabled:opacity-40"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {toast ? (
        <p className="pointer-events-none fixed bottom-[calc(var(--admin-dock)+1rem)] left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1d1d1f] px-4 py-2 text-[12px] text-white shadow-lg lg:bottom-6">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

function CreateCodeCard({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (body: {
    code: string;
    kind: CartOfferKind;
    value: number;
    maxUses: number | null;
    note: string;
  }) => Promise<boolean>;
}) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<CartOfferKind>("percent");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [note, setNote] = useState("");
  const [local, setLocal] = useState("");

  const valueNumber = Number(value.replace(/[^\d]/g, "")) || 0;
  const canSubmit =
    normalizeDiscountCode(code).length >= 3 &&
    valueNumber > 0 &&
    (kind === "amount" || valueNumber <= 100);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocal("");
    if (!canSubmit) {
      setLocal(
        kind === "percent" && valueNumber > 100
          ? "El porcentaje va de 1 a 100."
          : "Código de 3 a 20 caracteres y un valor mayor a cero.",
      );
      return;
    }
    const ok = await onCreate({
      code: normalizeDiscountCode(code),
      kind,
      value: valueNumber,
      maxUses: maxUses.trim() ? Number(maxUses.replace(/[^\d]/g, "")) || null : null,
      note: note.trim(),
    });
    if (ok) {
      setCode("");
      setValue("");
      setMaxUses("");
      setNote("");
    }
  }

  const preview =
    valueNumber > 0
      ? kind === "percent"
        ? `${Math.min(100, valueNumber)} % sobre el subtotal`
        : `${formatMoney(valueNumber)} sobre el subtotal`
      : "Elige el tipo y el valor.";

  return (
    <form onSubmit={submit} className="admin-sheet">
      <div className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-5">
        <div>
          <p className="text-[13px] font-medium">Nuevo código</p>
          <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{preview}</p>
        </div>
        <div className="flex rounded-full bg-[var(--admin-field)] p-0.5 text-[12px]">
          {(["percent", "amount"] as CartOfferKind[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={`h-8 rounded-full px-3 ${
                kind === option ? "bg-[#1d1d1f] text-white" : "text-[var(--admin-muted)]"
              }`}
            >
              {option === "percent" ? "Porcentaje" : "Pesos"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid sm:grid-cols-2">
        <label className="admin-field">
          <span>Código</span>
          <div className="flex items-center gap-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="MORAFRIENDS"
              maxLength={20}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="admin-input font-mono uppercase tracking-[0.06em]"
            />
            <button
              type="button"
              onClick={() => setCode(randomCode())}
              className="h-7 shrink-0 rounded-full bg-[var(--admin-field)] px-3 text-[11px] text-[var(--admin-muted)]"
            >
              Generar
            </button>
          </div>
        </label>
        <label className="admin-field sm:border-l sm:border-t-0">
          <span>{kind === "percent" ? "Porcentaje" : "Valor en pesos"}</span>
          <div className="flex items-baseline gap-1">
            {kind === "amount" ? <span className="text-[17px] text-[var(--admin-muted)]">$</span> : null}
            <input
              value={value}
              onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder={kind === "percent" ? "10" : "50000"}
              className="admin-input"
            />
            {kind === "percent" ? <span className="text-[17px] text-[var(--admin-muted)]">%</span> : null}
          </div>
        </label>
        <label className="admin-field">
          <span>Límite de usos</span>
          <input
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="Sin límite"
            className="admin-input"
          />
        </label>
        <label className="admin-field sm:border-l">
          <span>Nota (solo para el equipo)</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={120}
            placeholder="Campaña de lanzamiento"
            className="admin-input"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-line)] px-4 py-3 sm:px-5">
        <p className="text-[12px] text-[var(--admin-muted)]">
          {local || "Los códigos MORA-XXXX quedan reservados para carritos recuperados."}
        </p>
        <button
          type="submit"
          disabled={busy}
          className="admin-cta h-10 w-auto px-5 text-[14px] disabled:opacity-40"
        >
          {busy ? "Creando…" : "Crear código"}
        </button>
      </div>
    </form>
  );
}

function StatusChip({ status }: { status: DiscountCodeStatus }) {
  const tone =
    status === "active"
      ? "bg-[rgba(31,122,56,0.1)] text-[var(--admin-ok)]"
      : status === "paused"
        ? "bg-[var(--admin-field)] text-[var(--admin-muted)]"
        : "bg-[rgba(180,35,24,0.08)] text-[var(--admin-danger)]";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] ${tone}`}>
      {DISCOUNT_STATUS_LABEL[status]}
    </span>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="ventas-kpi">
      <p className="text-[11px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">{hint}</p>
    </div>
  );
}
