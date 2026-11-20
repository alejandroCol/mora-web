"use client";

import { useEffect, useState } from "react";

const BAR_VAR = "--offer-bar";
const BAR_HEIGHT = "40px";

function two(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Franja negra sobre el encabezado cuando alguien llega al checkout por el enlace de su descuento.
 * Cuenta hacia atrás cada segundo. Empuja el encabezado y la página con `--offer-bar`.
 */
export function OfferBar({
  label,
  expiresAt,
  onExpire,
}: {
  /** «10% de descuento» o «$ 50.000 de descuento». */
  label: string;
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

  let clock = "";
  if (left != null && left > 0) {
    const total = Math.floor(left / 1000);
    const days = Math.floor(total / 86_400);
    const hours = Math.floor((total % 86_400) / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    clock = `${days > 0 ? `${days} d ` : ""}${two(hours)}:${two(mins)}:${two(secs)}`;
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-[#0b0b0d] pt-[env(safe-area-inset-top)] text-white"
    >
      <div className="flex h-10 items-center justify-center gap-2.5 whitespace-nowrap px-3 text-[13px] leading-none tracking-[-0.01em]">
        {expired ? (
          <span className="text-white/80">Tu descuento ya venció</span>
        ) : (
          <>
            <span className="font-medium">{label}</span>
            {clock ? (
              <>
                <span aria-hidden className="h-3 w-px bg-white/25" />
                <span className="text-white/65 max-[339px]:hidden">Termina en</span>
                <span className="font-medium tabular-nums">{clock}</span>
              </>
            ) : (
              <span className="text-white/65">aplicado a tu pedido</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
