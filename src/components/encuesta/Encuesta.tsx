"use client";

import { useEffect, useState } from "react";
import { RINGS, isGender, isRingId, ringById, type Gender, type RingId } from "@/lib/encuesta";

const STORAGE = "mora-encuesta-v1";

type Saved = {
  voterId: string;
  gender: Gender;
  picks: RingId[];
};

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    if (typeof parsed.voterId !== "string" || !parsed.voterId) return null;
    if (typeof parsed.gender !== "string" || !isGender(parsed.gender)) return null;
    if (!Array.isArray(parsed.picks) || parsed.picks.length !== 3) return null;
    if (!parsed.picks.every((id) => typeof id === "string" && isRingId(id))) return null;
    return {
      voterId: parsed.voterId,
      gender: parsed.gender,
      picks: parsed.picks,
    };
  } catch {
    return null;
  }
}

export function Encuesta() {
  const [hydrated, setHydrated] = useState(false);
  const [voterId, setVoterId] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [picks, setPicks] = useState<RingId[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setVoterId(saved.voterId);
      setGender(saved.gender);
      setPicks(saved.picks);
      setDone(true);
    }
    setHydrated(true);
  }, []);

  function toggle(id: RingId) {
    const index = picks.indexOf(id);
    if (index >= 0) {
      setNotice(null);
      setPicks(picks.filter((item) => item !== id));
      return;
    }
    if (picks.length >= 3) {
      setNotice("Toca uno marcado para quitarlo.");
      return;
    }
    setNotice(null);
    setPicks([...picks, id]);
  }

  function submitBlocker(): string | null {
    if (!gender) return "Te falta seleccionar el género.";
    const missing = 3 - picks.length;
    if (missing === 3) return "Te faltan los tres colores del podio.";
    if (missing === 2) return "Te faltan dos colores más en el podio.";
    if (missing === 1) return "Te falta un color más en el podio.";
    return null;
  }

  async function submit() {
    if (pending) return;
    const blocker = submitBlocker();
    if (blocker) {
      setError(null);
      setNotice(blocker);
      return;
    }
    if (!gender || picks.length !== 3) return;
    setPending(true);
    setError(null);
    setNotice(null);
    const id = voterId || crypto.randomUUID();
    try {
      const res = await fetch("/api/encuesta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: id, gender, picks }),
      });
      const data = (await res.json()) as { ok?: boolean; voterId?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo enviar.");
      const saved: Saved = {
        voterId: data.voterId || id,
        gender,
        picks,
      };
      localStorage.setItem(STORAGE, JSON.stringify(saved));
      setVoterId(saved.voterId);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar.");
    } finally {
      setPending(false);
    }
  }

  if (!hydrated) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
        <p className="text-soft">Cargando…</p>
      </main>
    );
  }

  if (done && gender) {
    return (
      <ThankYou
        gender={gender}
        picks={picks}
        onEdit={() => {
          setDone(false);
          setNotice(null);
          setError(null);
        }}
      />
    );
  }

  const hint = !gender
    ? "Marca si eres hombre o mujer."
    : picks.length === 0
      ? "Toca tu favorito."
      : picks.length === 1
        ? "Ahora el segundo."
        : picks.length === 2
          ? "Y uno más."
          : "Así quedó tu top 3.";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-28 pt-[max(0.85rem,env(safe-area-inset-top))]">
      <p className="kicker">Mora</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="display text-[2.05rem] leading-[0.95] text-ink">Tus tres colores</h1>
          <p className="mt-1.5 text-[14px] leading-snug text-soft">
            Toca en orden. El 1 es el que más usarías.
          </p>
        </div>
        <Podium picks={picks} />
      </div>

      <div
        role="radiogroup"
        aria-label="Sexo"
        className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-dawn p-1"
      >
        <GenderButton
          selected={gender === "mujer"}
          onClick={() => {
            setNotice(null);
            setGender("mujer");
          }}
        >
          Soy mujer
        </GenderButton>
        <GenderButton
          selected={gender === "hombre"}
          onClick={() => {
            setNotice(null);
            setGender("hombre");
          }}
        >
          Soy hombre
        </GenderButton>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5" role="group" aria-label="Colores">
        {RINGS.map((ring) => {
          const rank = picks.indexOf(ring.id);
          const selected = rank >= 0;
          return (
            <button
              key={ring.id}
              type="button"
              onClick={() => toggle(ring.id)}
              aria-pressed={selected}
              aria-label={
                selected ? `${ring.title}, puesto ${rank + 1}` : ring.title
              }
              className={`relative cursor-pointer overflow-hidden rounded-[1.35rem] bg-dawn text-left transition active:scale-[0.98] ${
                selected ? "ring-2 ring-ink" : picks.length === 3 ? "opacity-55" : ""
              }`}
            >
              {selected ? (
                <span className="absolute left-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[15px] font-medium text-white">
                  {rank + 1}
                </span>
              ) : null}
              <img
                src={ring.src}
                alt=""
                className="aspect-[4/3] w-full object-contain"
                draggable={false}
              />
              <span className="block px-3 pb-2.5 text-[14px] font-medium tracking-[-0.01em]">
                {ring.title}
              </span>
            </button>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto w-full max-w-md px-4 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2.5">
          <p className="text-center text-[13px] text-soft">{notice ?? hint}</p>
          {error ? (
            <p className="mt-1 text-center text-[13px] text-ink">{error}</p>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => void submit()}
            className="mt-2 h-12 w-full cursor-pointer rounded-full bg-ink text-[15px] font-medium text-white disabled:cursor-default disabled:opacity-35"
          >
            {pending ? "Enviando…" : "Enviar voto"}
          </button>
        </div>
      </div>
    </main>
  );
}

const PODIUM = [
  { slot: 1, bar: "h-7" },
  { slot: 0, bar: "h-11" },
  { slot: 2, bar: "h-5" },
] as const;

function Podium({ picks }: { picks: RingId[] }) {
  const names = picks.map((id) => ringById(id)?.title).filter(Boolean);
  const label =
    names.length === 0 ? "Top 3, todavía vacío" : `Top 3: ${names.join(", ")}`;

  return (
    <div className="shrink-0" role="img" aria-label={label}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-[0.14em] text-soft">Top 3</p>
      <div className="flex items-end gap-[3px]">
        {PODIUM.map(({ slot, bar }) => {
          const ring = ringById(picks[slot] ?? "");
          return (
            <div key={slot} className="flex w-9 flex-col items-center">
              <div className="flex h-9 w-full items-end justify-center">
                {ring ? (
                  <img
                    key={ring.id}
                    src={`/encuesta/podio-${ring.id}.jpg`}
                    alt=""
                    className="podium-pop relative z-10 -mb-1 h-9 w-full object-contain"
                    draggable={false}
                  />
                ) : null}
              </div>
              <div
                className={`flex w-full items-end justify-center rounded-t-md pb-0.5 text-[11px] font-medium transition-colors ${bar} ${
                  ring ? "bg-ink text-white" : "bg-lilac text-soft"
                }`}
              >
                {slot + 1}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GenderButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`h-11 cursor-pointer rounded-full text-[15px] font-medium transition-colors ${
        selected ? "bg-ink text-white" : "text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ThankYou({
  gender,
  picks,
  onEdit,
}: {
  gender: Gender;
  picks: RingId[];
  onEdit: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <p className="kicker">{gender === "mujer" ? "Mujer" : "Hombre"}</p>
      <h1 className="display mt-3 text-[2.7rem] leading-[0.92]">Listo.</h1>
      <p className="mt-3 text-[15px] text-soft">Gracias. Tu top 3 quedó guardado.</p>
      <ol className="mt-8 space-y-2">
        {picks.map((id, index) => {
          const ring = RINGS.find((item) => item.id === id);
          if (!ring) return null;
          return (
            <li
              key={id}
              className="flex items-center gap-3 rounded-[1.2rem] bg-dawn px-3 py-2"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[14px] text-white">
                {index + 1}
              </span>
              <img src={ring.src} alt="" className="h-14 w-14 object-contain" />
              <span className="text-[16px]">{ring.title}</span>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={onEdit}
        className="mt-8 h-12 rounded-full bg-ink text-[15px] font-medium text-white"
      >
        Cambiar mi voto
      </button>
      <a
        href="/encuesta/resultados"
        className="mt-4 text-center text-[14px] text-soft underline-offset-4 hover:underline"
      >
        Ver resultados
      </a>
    </main>
  );
}
