import { BrandSignature } from "@/components/brand/BrandSignature";

const rows = [
  ["Sensores", "Pulso, oxígeno, HRV, sueño, movimiento"],
  ["Autonomía", "Cinco a siete días"],
  ["Agua", "IP67 / 5 ATM"],
  ["Compañero", "App Mora para iOS"],
  ["Talla", "6 a 13 · kit de medida"],
  ["Envío", "Según destino, cotizado al instante"],
];

export function Close() {
  return (
    <section className="border-t border-line bg-white">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-28">
        <p className="display text-[clamp(2rem,8vw,3.8rem)] leading-[1.08] text-ink">
          Cabe en un dedo.
        </p>
        <dl className="mt-10 divide-y divide-line sm:mt-16">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[5.5rem_1fr] gap-4 py-4 sm:grid-cols-[8rem_1fr] sm:gap-6 sm:py-5"
            >
              <dt className="text-[13px] text-soft">{label}</dt>
              <dd className="text-[15px] text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <BrandSignature className="mt-14 sm:mt-20" />
      </div>
    </section>
  );
}
