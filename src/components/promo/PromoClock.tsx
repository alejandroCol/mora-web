"use client";

import { useEffect, useState } from "react";
import { usePromoClockOffset } from "@/components/sales/SalesProvider";

export type TimeParts = { days: number; hours: number; mins: number; secs: number; totalMs: number };

export function splitTime(ms: number): TimeParts {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    mins: Math.floor((total % 3600) / 60),
    secs: total % 60,
    totalMs: Math.max(0, ms),
  };
}

export function two(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Milisegundos que faltan para `target`, con la hora del servidor. Late justo después de cada
 * segundo. `null` hasta montar: el HTML del servidor no trae una hora que luego no coincida.
 */
export function useRemaining(target: number) {
  const offset = usePromoClockOffset();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const ms = Math.max(0, target - (Date.now() + offset));
      setLeft(ms);
      if (ms > 0) timer = window.setTimeout(tick, (ms % 1000) + 30);
    };
    timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
  }, [target, offset]);

  return left;
}

/** Dos cifras. Solo la que cambia vuelve a entrar. */
export function RollNumber({ value }: { value: string }) {
  return (
    <span className="promo-num" aria-hidden>
      {value.split("").map((digit, index) => (
        <span key={`${index}-${digit}`} className="promo-digit">
          {digit}
        </span>
      ))}
    </span>
  );
}

export function spokenTime(parts: TimeParts) {
  const bits: string[] = [];
  if (parts.days > 0) bits.push(`${parts.days} ${parts.days === 1 ? "día" : "días"}`);
  if (parts.days > 0 || parts.hours > 0) bits.push(`${parts.hours} ${parts.hours === 1 ? "hora" : "horas"}`);
  bits.push(`${parts.mins} ${parts.mins === 1 ? "minuto" : "minutos"}`);
  return bits.join(", ");
}
