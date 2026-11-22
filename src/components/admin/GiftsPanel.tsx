"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { giftPieces, type GiftRecord } from "@/commerce/gifts";
import { commerceLineLabel } from "@/commerce/sizing";
import { CHANNEL_LABEL } from "@/crm/channel";
import { formatMoney } from "@/lib/catalog";

function formatDay(at: number) {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(at);
}

/** Lo regalado: a quién, qué piezas y cuánto valían. Anular devuelve las piezas al inventario. */
export function GiftsPanel({
  gifts,
  query,
  onNew,
  onVoid,
}: {
  gifts: GiftRecord[] | null;
  query: string;
  onNew: () => void;
  onVoid: (gift: GiftRecord) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const given = useMemo(() => (gifts ?? []).filter((gift) => gift.status === "given"), [gifts]);
  const totals = useMemo(
    () => ({
      pieces: given.reduce((sum, gift) => sum + giftPieces(gift), 0),
      value: given.reduce((sum, gift) => sum + gift.valueCop, 0),
      people: new Set(given.map((gift) => gift.recipient.conversationId || gift.recipient.name.toLowerCase()))
        .size,
    }),
    [given],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gifts ?? [];
    return (gifts ?? []).filter(
      (gift) =>
        gift.recipient.name.toLowerCase().includes(q) ||
        (gift.recipient.contact ?? "").toLowerCase().includes(q) ||
        (gift.note ?? "").toLowerCase().includes(q) ||
        gift.items.some((item) => commerceLineLabel(item).toLowerCase().includes(q)),
    );
  }, [gifts, query]);

  async function run(gift: GiftRecord) {
    setBusy(gift.id);
    setError("");
    try {
      await onVoid(gift);
      setConfirming("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo anular el regalo.");
    } finally {
      setBusy("");
    }
  }

  if (gifts === null) {
    return (
      <p className="rounded-[1.25rem] bg-white px-5 py-8 text-[14px] text-[var(--admin-muted)] shadow-[var(--admin-shadow)]">
        Cargando regalos…
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="ventas-kpis">
        <GiftKpi label="Piezas regaladas" value={String(totals.pieces)} hint="Ya descontadas del inventario" />
        <GiftKpi label="Personas" value={String(totals.people)} hint="Creadores y cortesías" />
        <GiftKpi label="Valor comercial" value={formatMoney(totals.value)} hint="No cuenta como ingreso" />
      </div>

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-900">{error}</p>
      ) : null}

      <ul className="space-y-2">
        {filtered.length === 0 ? (
          <li className="rounded-[1.25rem] bg-white px-5 py-8 text-[14px] text-[var(--admin-muted)] shadow-[var(--admin-shadow)]">
            {gifts.length === 0 ? "Aún no hay regalos registrados." : "Ningún regalo coincide."}
            {gifts.length === 0 ? (
              <button type="button" onClick={onNew} className="ml-2 underline text-[#1d1d1f]">
                Registrar el primero
              </button>
            ) : null}
          </li>
        ) : (
          filtered.map((gift) => {
            const voided = gift.status === "voided";
            const { recipient } = gift;
            return (
              <li key={gift.id} className={`ventas-row ${voided ? "opacity-55" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{recipient.name}</p>
                    <p className="mt-1 text-[13px] text-[var(--admin-muted)]">
                      {[
                        recipient.conversationId && recipient.channel
                          ? `Chat de ${CHANNEL_LABEL[recipient.channel]}`
                          : "Sin chat",
                        recipient.contact,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <ul className="mt-2 text-[14px]">
                      {gift.items.map((item) => (
                        <li key={item.key}>{commerceLineLabel(item)}</li>
                      ))}
                    </ul>
                    {gift.note ? (
                      <p className="mt-2 text-[13px] text-[var(--admin-muted)]">{gift.note}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-[var(--admin-muted)]">
                      {formatDay(gift.createdAt)}
                      {gift.createdByName ? ` · registró ${gift.createdByName}` : ""}
                      {voided && gift.voidedAt ? ` · anulado el ${formatDay(gift.voidedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-[15px] font-medium">{formatMoney(gift.valueCop)}</p>
                    <p className="text-[11px] text-[var(--admin-muted)]">
                      {voided ? "Anulado · volvió al inventario" : "Regalado"}
                    </p>
                    {recipient.conversationId ? (
                      <Link
                        href={`/superadmin/crm?c=${recipient.conversationId}`}
                        className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px] leading-9"
                      >
                        Ver chat
                      </Link>
                    ) : null}
                    {!voided ? (
                      confirming === gift.id ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => void run(gift)}
                            className="h-9 rounded-full bg-[var(--admin-danger)] px-4 text-[12px] text-white disabled:opacity-40"
                          >
                            {busy === gift.id ? <span className="btn-spin" aria-hidden /> : null}
                            Sí, devolver al inventario
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => setConfirming("")}
                            className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => setConfirming(gift.id)}
                          className="h-9 rounded-full px-4 text-[12px] text-[var(--admin-danger)] hover:bg-red-50"
                        >
                          Anular
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function GiftKpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="ventas-kpi">
      <p className="text-[11px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">{hint}</p>
    </div>
  );
}
