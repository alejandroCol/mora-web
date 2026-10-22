"use client";

import { useEffect, useState } from "react";
import type { PaymentPolicy } from "@/commerce/payments";
import { isPrivilegedRole } from "@/commerce/roles";
import {
  PRESALE_DEFAULT_SALE_ON,
  type SalesMode,
  type SalesPolicy,
} from "@/commerce/sales";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { useAdminAuth } from "./AdminAuth";

function Switch({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        on ? "bg-[#f4f1ea]" : "bg-white/15"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 h-6 w-6 rounded-full transition-transform ${
          on ? "translate-x-5 bg-[#0e0d14]" : "translate-x-0.5 bg-white/80"
        }`}
      />
    </button>
  );
}

export function SettingsView() {
  const { authorizedFetch, me } = useAdminAuth();
  const privileged = Boolean(me && isPrivilegedRole(me.role));
  const [sales, setSales] = useState<SalesPolicy | null>(null);
  const [payments, setPayments] = useState<PaymentPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!privileged) return;
    void authorizedFetch("/api/admin/store")
      .then((res) => res.json())
      .then((data: { ok?: boolean; sales?: SalesPolicy; payments?: PaymentPolicy; error?: string }) => {
        if (data.ok && data.sales && data.payments) {
          setSales(data.sales);
          setPayments(data.payments);
        } else {
          setError(data.error || "No se pudieron leer los ajustes.");
        }
      })
      .catch(() => setError("No se pudieron leer los ajustes."));
  }, [authorizedFetch, privileged]);

  async function persist(patch: {
    sales?: { mode: SalesMode; saleOn: string | null };
    payments?: { live: boolean };
  }) {
    setBusy(true);
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/store", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        sales?: SalesPolicy;
        payments?: PaymentPolicy;
        error?: string;
      };
      if (!data.ok || !data.sales || !data.payments) {
        throw new Error(data.error || "No se pudo guardar.");
      }
      setSales(data.sales);
      setPayments(data.payments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  if (!privileged) {
    return (
      <div className="max-w-xl">
        <h1 className="font-display text-4xl tracking-[-0.05em] text-[#f4f1ea]">Ajustes.</h1>
        <p className="mt-3 text-sm leading-6 text-white/45">
          Solo un super admin puede cambiar la pasarela y la preventa.
        </p>
      </div>
    );
  }

  if (!sales || !payments) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <BrandLoader label="Cargando ajustes" />
      </div>
    );
  }

  const live = payments.live;
  const presale = sales.mode === "presale";
  const saleOn = sales.saleOn || PRESALE_DEFAULT_SALE_ON;

  return (
    <div className="max-w-xl">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Casa</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.05em] text-[#f4f1ea]">Ajustes.</h1>
      <p className="mt-2 text-sm leading-6 text-white/45">
        Un solo lugar para la pasarela y el modo de venta. Hoy la tienda cobra en producción.
      </p>

      <section className="mt-8 rounded-2xl bg-white/[0.05] px-4 py-4 text-sm text-white/80">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] text-[#f4f1ea]">Pasarela en producción</p>
            <p className="mt-1 text-[12px] leading-5 text-white/45">
              {live
                ? "Bold y Addi cobran de verdad. Los pagos salen normales."
                : "Bold y Addi están en pruebas. No se cobra dinero real."}
            </p>
          </div>
          <Switch
            on={live}
            disabled={busy}
            onToggle={() => void persist({ payments: { live: !live } })}
          />
        </div>
      </section>

      <section className="mt-3 rounded-2xl bg-white/[0.05] px-4 py-4 text-sm text-white/80">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] text-[#f4f1ea]">Activar preventa</p>
            <p className="mt-1 text-[12px] leading-5 text-white/45">
              {presale
                ? "La tienda reserva. El anillo sale en la fecha de venta."
                : "Venta inmediata. El botón dice Comprar. La reserva queda apagada, no borrada."}
            </p>
          </div>
          <Switch
            on={presale}
            disabled={busy}
            onToggle={() =>
              void persist({
                sales: { mode: presale ? "immediate" : "presale", saleOn },
              })
            }
          />
        </div>
        {presale ? (
          <label className="mt-4 block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/35">
              Fecha de venta
            </span>
            <input
              type="date"
              value={saleOn}
              disabled={busy}
              onChange={(event) =>
                void persist({
                  sales: { mode: "presale", saleOn: event.target.value || saleOn },
                })
              }
              className="mt-2 h-11 w-full rounded-xl border-0 bg-white/8 px-3 text-[14px] text-[#f4f1ea] outline-none ring-0 [color-scheme:dark]"
            />
          </label>
        ) : null}
      </section>

      {error ? <p className="mt-4 text-[12px] leading-5 text-red-300">{error}</p> : null}
    </div>
  );
}
