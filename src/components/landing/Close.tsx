const rows = [
  ["Sensores", "Pulso, oxígeno, HRV, sueño, movimiento"],
  ["Autonomía", "Cinco a siete días"],
  ["Agua", "IP67 / 5 ATM"],
  ["Compañero", "App Mora para iOS"],
  ["Talla", "6 a 13 · kit de medida"],
  ["Envío", "Incluido"],
];

export function Close() {
  return (
    <section className="border-t border-line bg-white">
      <div className="mx-auto max-w-2xl px-6 py-28">
        <p className="display text-[clamp(2.4rem,5.2vw,3.8rem)] leading-[1.08] text-ink">
          Cabe en un dedo.
        </p>
        <dl className="mt-16 divide-y divide-line">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[6.5rem_1fr] gap-6 py-5 sm:grid-cols-[8rem_1fr]"
            >
              <dt className="text-[13px] text-soft">{label}</dt>
              <dd className="text-[15px] text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
