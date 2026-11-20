"use client";

import { useEffect, useState } from "react";

const BAR_VAR = "--offer-bar";
const BAR_HEIGHT = "58px";

function two(value: number) {
  return String(value).padStart(2, "0");
}

function Tile({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="flex h-[30px] min-w-[34px] items-center justify-center rounded-[9px] bg-white/[0.12] px-1.5 text-[16px] font-medium tabular-nums tracking-[-0.01em] ring-1 ring-inset ring-white/10">
        {value}
      </span>
      <span className="mt-[3px] text-[8.5px] font-medium uppercase leading-none tracking-[0.14em] text-white/50">
        {unit}
      </span>
    </span>
  );
}

function Colon() {
  return <span aria-hidden className="mb-[11px] text-[14px] text-white/35">:</span>;
}

/**
 * Franja negra sobre el encabezado cuando alguien llega al checkout por el enlace de su descuento.
 * Cuenta hacia atrás cada segundo. Empuja el encabezado y la página con `--offer-bar`.
 */
export function OfferBar({
  figure,
  expiresAt,
  onExpire,
}: {
  /** «10%» o «$ 50.000». */
  figure: string;
  expiresAt?: number;
  onExpire: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(BAR_VAR, BAR_HEIGHT);
    return () => {
      root.style.removeProperty(BAR_VAR);
    };
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const left = expiresAt ? Math.max(0, expiresAt - now) : null;
  const expired = left === 0;

  useEffect(() => {
    if (expired) onExpire();
    // Solo al pasar a vencido.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onExpire cambia en cada render
  }, [expired]);

  const total = left ? Math.floor(left / 1000) : 0;
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  return (
    <div
      role={expired ? "status" : undefined}
      className="fixed inset-x-0 top-0 z-50 bg-[#09090b] pt-[env(safe-area-inset-top)] text-white"
    >
      <div className="flex h-[58px] items-center justify-center gap-4 whitespace-nowrap px-4 sm:gap-6">
        {expired ? (
          <span className="text-[14px] text-white/80">Tu descuento ya venció</span>
        ) : (
          <>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[24px] font-medium leading-none tracking-[-0.03em]">{figure}</span>
              <span className="text-[13px] leading-none text-white/75">
                de descuento<span className="max-[479px]:hidden"> en tu pedido</span>
              </span>
            </span>
            {left ? (
              <>
                <span aria-hidden className="h-7 w-px bg-white/15" />
                <span className="flex items-center gap-1" aria-label={`Termina en ${days > 0 ? `${days} días, ` : ""}${hours} horas y ${mins} minutos`}>
                  {days > 0 ? (
                    <>
                      <Tile value={two(days)} unit={days === 1 ? "día" : "días"} />
                      <Colon />
                    </>
                  ) : null}
                  <Tile value={two(hours)} unit="h" />
                  <Colon />
                  <Tile value={two(mins)} unit="min" />
                  <span className={`flex items-center gap-1 ${days > 0 ? "max-[419px]:hidden" : ""}`}>
                    <Colon />
                    <Tile value={two(secs)} unit="seg" />
                  </span>
                </span>
              </>
            ) : null}
          </>
        )}
      </div>
      <div
        aria-hidden
        className="h-px bg-[linear-gradient(90deg,transparent,rgba(163,148,228,0.9),transparent)]"
      />
    </div>
  );
}
