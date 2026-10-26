"use client";

import { BrandSignature } from "@/components/brand/BrandSignature";
import { useSales } from "@/components/sales/SalesProvider";
import { sizeRangeLabel } from "@/lib/catalog";

export function Close() {
  const sales = useSales();
  const rows = [
    ["Autonomía", "Cinco a siete días"],
    ["Talla", `${sizeRangeLabel()} · medidor o guía`],
    [sales.closeLabel, sales.closeValue],
  ] as const;

  return (
    <section className="border-t border-line bg-white">
      <div className="mx-auto max-w-xl px-6 py-16 sm:py-24">
        <p className="display text-[clamp(2rem,8vw,3.4rem)] leading-[1.08] text-ink">
          Cabe en un dedo.
        </p>
        <dl className="mt-10 divide-y divide-line sm:mt-12">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[6.5rem_1fr] items-baseline gap-4 py-3.5 sm:grid-cols-[7.5rem_1fr]"
            >
              <dt className="text-[13px] text-soft">{label}</dt>
              <dd className="text-[15px] tracking-[-0.018em] text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <BrandSignature className="mt-12 sm:mt-16" />
      </div>
    </section>
  );
}
