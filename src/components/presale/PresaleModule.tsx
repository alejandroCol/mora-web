"use client";

import { useEffect, useState } from "react";
import { presaleRemaining } from "@/lib/presale";
import { useSales } from "@/components/sales/SalesProvider";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function unitsFrom(ms: number) {
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

export function PresaleModule() {
  const sales = useSales();
  const [remaining, setRemaining] = useState<number | null>(null);
  const saleAt = sales.saleAt ?? 0;

  useEffect(() => {
    const tick = () => setRemaining(presaleRemaining(saleAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [saleAt]);

  if (!sales.showPresaleModule) return null;

  const units = unitsFrom(remaining ?? 0);
  const open = remaining == null || remaining > 0;
  const ticks = [
    [units.days, "días"],
    [units.hours, "horas"],
    [units.minutes, "min"],
    [units.seconds, "seg"],
  ] as const;

  return (
    <section id="preventa" className="presale-wash scroll-mt-24">
      <div className="mx-auto max-w-[980px] px-6 py-24 sm:py-32">
        <div className="text-center">
          <p className="presale-seal">{sales.label}</p>
          <h2 className="title-name mx-auto mt-4 max-w-[18ch] text-[clamp(2.35rem,6.4vw,4.25rem)] text-[#1d1d1f]">
            Disponible el {sales.deliveryLabel}.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[17px] leading-7 text-soft sm:text-[21px] sm:leading-8">
            {sales.whisper}
          </p>
        </div>

        {open ? (
          <ol
            className="mx-auto mt-14 flex items-end justify-center gap-4 sm:mt-16 sm:gap-8"
            aria-hidden={remaining == null}
          >
            {ticks.map(([value, label], index) => (
              <li key={label} className="flex items-end gap-4 sm:gap-8">
                <div className="min-w-[3.4rem] text-center sm:min-w-[4.2rem]">
                  <p className="text-[2rem] font-semibold tabular-nums tracking-[-0.04em] text-[#1d1d1f] sm:text-[2.75rem]">
                    {remaining == null ? "—" : pad(value)}
                  </p>
                  <p className="mt-1 text-[12px] text-soft">{label}</p>
                </div>
                {index < ticks.length - 1 ? (
                  <span
                    aria-hidden
                    className="mb-[1.35rem] text-[1.35rem] font-light text-[#d2d2d7] sm:mb-[1.7rem] sm:text-[1.75rem]"
                  >
                    :
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-14 text-center text-[17px] text-[#1d1d1f]">
            La preventa cerró. El anillo ya está en camino.
          </p>
        )}

        <div className="mt-16 flex justify-center">
          <a href="#coleccion" className="elegir-cta">
            Elegir mi Mora
            <span aria-hidden className="elegir-cta-arrow">
              ›
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
