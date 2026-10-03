import { RINGS } from "@/lib/encuesta";
import { surveyResults, type ColorTally } from "@/server/encuesta";

export const dynamic = "force-dynamic";

export default async function ResultadosPage() {
  const results = await surveyResults();
  const max = Math.max(1, ...results.colors.map((color) => color.points));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <a href="/encuesta" className="kicker">
        Mora · encuesta
      </a>
      <h1 className="display mt-3 text-[2.55rem] leading-[0.92]">Resultados</h1>
      <p className="mt-3 text-[15px] leading-snug text-soft">
        {results.total === 0
          ? "Todavía no hay votos."
          : `${results.total} ${results.total === 1 ? "voto" : "votos"}. El 1º vale 3, el 2º vale 2, el 3º vale 1.`}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Stat label="Mujeres" value={results.byGender.mujer} />
        <Stat label="Hombres" value={results.byGender.hombre} />
      </div>

      <Section title="Todos" colors={results.colors} max={max} empty={results.total === 0} />
      <Section
        title="Mujeres"
        colors={results.mujer}
        max={Math.max(1, ...results.mujer.map((color) => color.points))}
        empty={results.byGender.mujer === 0}
      />
      <Section
        title="Hombres"
        colors={results.hombre}
        max={Math.max(1, ...results.hombre.map((color) => color.points))}
        empty={results.byGender.hombre === 0}
      />

      <p className="mt-10 text-[12px] leading-relaxed text-soft">
        Colores: {RINGS.map((ring) => ring.title).join(", ")}.
      </p>
      <a
        href="/encuesta/resultados"
        className="mt-4 inline-block text-[14px] text-ink underline-offset-4 hover:underline"
      >
        Actualizar
      </a>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.2rem] bg-dawn px-4 py-3">
      <p className="text-[13px] text-soft">{label}</p>
      <p className="display mt-1 text-[2rem] leading-none">{value}</p>
    </div>
  );
}

function Section({
  title,
  colors,
  max,
  empty,
}: {
  title: string;
  colors: ColorTally[];
  max: number;
  empty: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[13px] uppercase tracking-[0.08em] text-soft">{title}</h2>
      {empty ? (
        <p className="mt-3 text-[15px] text-soft">Sin votos.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {colors.map((color, index) => (
            <li key={color.id} className="flex items-center gap-3">
              <img
                src={color.src}
                alt=""
                className="h-14 w-14 shrink-0 rounded-2xl bg-dawn object-contain"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[15px]">
                    <span className="mr-2 text-soft">{index + 1}</span>
                    {color.title}
                  </p>
                  <p className="shrink-0 text-[13px] text-soft">
                    {color.points} {color.points === 1 ? "pt" : "pts"} · {color.first}{" "}
                    {color.first === 1 ? "primero" : "primeros"}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-dawn">
                  <div
                    className="h-full rounded-full bg-ink"
                    style={{ width: `${Math.round((color.points / max) * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
