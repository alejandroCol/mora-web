"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePromoClockOffset } from "@/components/sales/SalesProvider";
import type { ModelId } from "@/lib/catalog";
import { nextSaleAt, soldCountAt } from "@/lib/soldCounter";

const MAX_WAIT = 6 * 3_600_000;
const count = new Intl.NumberFormat("es-CO");

/**
 * Vendidos, con la hora del servidor para que todos vean lo mismo. Un solo temporizador,
 * puesto al instante exacto de la próxima venta: entre ventas no corre nada.
 */
export function useSoldCount(modelId: ModelId) {
  const offset = usePromoClockOffset();
  const subscribe = useCallback(
    (notify: () => void) => {
      let timer = 0;
      const arm = () => {
        const now = Date.now() + offset;
        const wait = Math.min(MAX_WAIT, nextSaleAt(modelId, now) - now + 50);
        timer = window.setTimeout(() => {
          notify();
          arm();
        }, wait);
      };
      // Al volver a la pestaña el reloj pudo saltar: se reprograma.
      const onShow = () => {
        if (document.visibilityState !== "visible") return;
        window.clearTimeout(timer);
        notify();
        arm();
      };
      arm();
      document.addEventListener("visibilitychange", onShow);
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", onShow);
      };
    },
    [modelId, offset],
  );
  return useSyncExternalStore(
    subscribe,
    () => soldCountAt(modelId, Date.now() + offset),
    () => 0,
  );
}

export function SoldCount({ modelId, className = "" }: { modelId: ModelId; className?: string }) {
  const sold = useSoldCount(modelId);
  return (
    <p className={`sold-line ${className}`} aria-live="polite">
      <span aria-hidden className="sold-dot" />
      {sold ? (
        <>
          <span key={sold} className="sold-num">
            {count.format(sold)}
          </span>
          vendidos
        </>
      ) : (
        <span className="opacity-0">0 vendidos</span>
      )}
    </p>
  );
}
