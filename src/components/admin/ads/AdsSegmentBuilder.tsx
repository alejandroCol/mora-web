"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AGE_MAX,
  AGE_MIN,
  GENDER_LABEL,
  MAIN_CITIES,
  MAX_INTERESTS,
  MAX_PLACES,
  PLACEMENT_LABEL,
  RADIUS_MAX,
  RADIUS_MIN,
} from "@/ads/segment";
import type {
  AdsAudience,
  AdsEstimate,
  AdsForeignAudience,
  AdsGender,
  AdsInterestOption,
  AdsPick,
  AdsPlace,
  AdsPlacement,
  AdsSegment,
} from "@/ads/types";
import { CHIP, INPUT, SectionTitle, ToneLine, useAdsApi } from "./adsUi";

const ON = "bg-[#1d1d1f] text-white";
const OFF = "bg-[var(--admin-field)] text-[#1d1d1f] hover:bg-[#e8e8ed]";
const AGES = Array.from({ length: AGE_MAX - AGE_MIN + 1 }, (_, index) => AGE_MIN + index);
const RADII = [0, RADIUS_MIN, 25, 40, 60, RADIUS_MAX];

type Option = { id: string; name: string; note: string; disabled: boolean };

/**
 * A quién le llega el anuncio. Cada cambio se le pregunta a Meta con el mismo
 * `targeting` que se publicaría: el tamaño y los avisos salen antes de gastar.
 */
export function AdsSegmentBuilder({
  value,
  onChange,
  audiences,
  others,
  lockStrict,
  onEstimate,
}: {
  value: AdsSegment;
  onChange: (next: AdsSegment) => void;
  audiences: AdsAudience[];
  others: AdsForeignAudience[];
  /** Remarketing: siempre exacta. */
  lockStrict?: boolean;
  onEstimate?: (estimate: AdsEstimate | null) => void;
}) {
  const api = useAdsApi();
  const key = JSON.stringify(value);
  const [estimate, setEstimate] = useState<{ key: string; data: AdsEstimate | null; error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void api
        .call<{ estimate: AdsEstimate }>("/api/admin/ads/targeting", "POST", { segment: JSON.parse(key) })
        .then((result) => {
          if (cancelled) return;
          const data = result.ok ? result.data.estimate : null;
          setEstimate({ key, data, error: result.ok ? "" : result.error });
          onEstimate?.(data);
        });
    }, 650);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `onEstimate` cambia en cada render del padre; el cálculo depende solo de la segmentación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key]);

  const set = (patch: Partial<AdsSegment>) => onChange({ ...value, ...patch });
  const loading = estimate?.key !== key;

  const options: Option[] = [
    ...audiences.map((item) => ({
      id: item.id,
      name: item.label,
      note: !item.id ? "Aún no existe en Meta" : item.size > 1000 ? `${item.size.toLocaleString("es-CO")}` : "Menos de 1.000",
      disabled: !item.id,
    })),
    ...others.map((item) => ({
      id: item.id,
      name: item.name,
      note: item.size > 1000 ? `${item.size.toLocaleString("es-CO")}` : "Menos de 1.000",
      disabled: false,
    })),
  ];

  function togglePick(field: "include" | "exclude", option: Option) {
    const other = field === "include" ? "exclude" : "include";
    const has = value[field].some((item) => item.id === option.id);
    set({
      [field]: has
        ? value[field].filter((item) => item.id !== option.id)
        : [...value[field], { id: option.id, name: option.name }],
      // La misma audiencia no puede estar dentro y fuera.
      [other]: value[other].filter((item) => item.id !== option.id),
    });
  }

  function addPlace(place: AdsPlace) {
    if (value.places.some((item) => item.key === place.key && item.type === place.type)) return;
    if (value.places.length >= MAX_PLACES) return;
    set({ scope: "places", places: [...value.places, place] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="grid min-w-0 gap-6">
        <Block title="Dónde" hint="Los lugares siempre se respetan: nadie por fuera ve el anuncio.">
          <div className="flex flex-wrap gap-2">
            <Choice on={value.scope === "country"} onClick={() => set({ scope: "country" })}>
              Toda Colombia
            </Choice>
            <Choice on={value.scope === "places"} onClick={() => set({ scope: "places" })}>
              Solo algunos lugares
            </Choice>
          </div>
          {value.scope === "places" ? (
            <div className="mt-3 grid gap-3">
              <SearchAdd<AdsPlace>
                placeholder="Busca una ciudad o un departamento"
                url={(q) => `/api/admin/ads/targeting?type=place&q=${encodeURIComponent(q)}`}
                pick={(data) => (data as { places?: AdsPlace[] }).places ?? []}
                rowKey={(place) => `${place.type}:${place.key}`}
                render={(place) => (
                  <>
                    {place.name}
                    <span className="ml-2 text-[var(--admin-muted)]">
                      {place.type === "region" ? "Departamento" : place.region || "Ciudad"}
                    </span>
                  </>
                )}
                onPick={addPlace}
              />
              {value.places.length === 0 ? (
                <button
                  type="button"
                  className={`${CHIP} ${OFF} w-fit`}
                  onClick={() => set({ scope: "places", places: MAIN_CITIES })}
                >
                  Usar las 6 ciudades principales
                </button>
              ) : (
                <ul className="grid gap-2">
                  {value.places.map((place) => (
                    <li
                      key={`${place.type}:${place.key}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[0.8rem] bg-[var(--admin-field)] px-3 py-2"
                    >
                      <span className="min-w-0 text-[13.5px] text-[#1d1d1f]">
                        {place.name}
                        <span className="ml-2 text-[12px] text-[var(--admin-muted)]">
                          {place.type === "region" ? "Departamento" : place.region}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {place.type === "city" ? (
                          <select
                            className="h-8 rounded-full bg-white px-2.5 text-[12.5px] text-[#1d1d1f] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
                            value={place.radiusKm ?? 0}
                            aria-label={`Radio alrededor de ${place.name}`}
                            onChange={(event) =>
                              set({
                                places: value.places.map((item) =>
                                  item === place ? { ...item, radiusKm: Number(event.target.value) } : item,
                                ),
                              })
                            }
                          >
                            {RADII.map((radius) => (
                              <option key={radius} value={radius}>
                                {radius === 0 ? "Solo la ciudad" : `+ ${radius} km`}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-full text-[var(--admin-muted)] hover:bg-white"
                          aria-label={`Quitar ${place.name}`}
                          onClick={() => set({ places: value.places.filter((item) => item !== place) })}
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </Block>

        <Block title="Quién">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GENDER_LABEL) as AdsGender[]).map((gender) => (
              <Choice key={gender} on={value.gender === gender} onClick={() => set({ gender })}>
                {GENDER_LABEL[gender]}
              </Choice>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-[#1d1d1f]">
            <span>De</span>
            <AgeSelect
              label="Edad mínima"
              value={value.ageMin}
              onChange={(ageMin) => set({ ageMin, ageMax: Math.max(ageMin, value.ageMax) })}
            />
            <span>a</span>
            <AgeSelect
              label="Edad máxima"
              value={value.ageMax}
              onChange={(ageMax) => set({ ageMax, ageMin: Math.min(ageMax, value.ageMin) })}
            />
            <span>años</span>
          </div>
        </Block>

        <Block
          title="Intereses"
          hint="Le llega a quien tenga cualquiera de estos (no todos a la vez). Sin intereses, Meta busca por el video."
        >
          <SearchAdd<AdsInterestOption>
            placeholder="Busca un interés: bienestar, yoga, joyería…"
            url={(q) => `/api/admin/ads/targeting?type=interest&q=${encodeURIComponent(q)}`}
            pick={(data) => (data as { interests?: AdsInterestOption[] }).interests ?? []}
            rowKey={(item) => item.id}
            render={(item) => (
              <>
                {item.name}
                {item.topic ? <span className="ml-2 text-[var(--admin-muted)]">{item.topic}</span> : null}
              </>
            )}
            onPick={(item) => {
              if (value.interests.some((current) => current.id === item.id)) return;
              if (value.interests.length >= MAX_INTERESTS) return;
              set({ interests: [...value.interests, { id: item.id, name: item.name }] });
            }}
          />
          {value.interests.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {value.interests.map((item) => (
                <Removable
                  key={item.id}
                  pick={item}
                  onRemove={() => set({ interests: value.interests.filter((current) => current.id !== item.id) })}
                />
              ))}
            </div>
          ) : null}
        </Block>

        <Block
          title="Audiencias propias"
          hint="Gente que Mora ya conoce. Se crean y se mantienen en la pestaña Audiencias."
        >
          <p className="text-[12.5px] text-[var(--admin-muted)]">Mostrarle a</p>
          <PickRow options={options} selected={value.include} onToggle={(option) => togglePick("include", option)} />
          <p className="mt-4 text-[12.5px] text-[var(--admin-muted)]">Nunca mostrarle a</p>
          <PickRow options={options} selected={value.exclude} onToggle={(option) => togglePick("exclude", option)} />
        </Block>

        <Block title="Qué tan al pie de la letra">
          <div className="grid gap-2 sm:grid-cols-2">
            <ModeCard
              on={!value.strict}
              disabled={lockStrict}
              title="Abierta"
              text="Meta parte de tu edad, sexo e intereses y se sale de ahí si encuentra a quien compra. Suele dar el chat más barato."
              onClick={() => set({ strict: false })}
            />
            <ModeCard
              on={value.strict}
              title="Exacta"
              text="Solo a quien cumple todo lo que marcaste. Úsala para remarketing o cuando el público es muy específico."
              onClick={() => set({ strict: true })}
            />
          </div>
          {lockStrict ? (
            <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
              En remarketing va exacta: si Meta se sale de tus audiencias, deja de ser remarketing.
            </p>
          ) : null}
        </Block>

        <Block title="Dónde aparece">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PLACEMENT_LABEL) as AdsPlacement[]).map((placement) => (
              <Choice key={placement} on={value.placement === placement} onClick={() => set({ placement })}>
                {PLACEMENT_LABEL[placement]}
              </Choice>
            ))}
          </div>
        </Block>
      </div>

      <aside className="h-fit rounded-[1rem] bg-[var(--admin-field)] p-4 lg:sticky lg:top-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--admin-muted)]">A cuánta gente le cabe</p>
        <p className={`mt-2 text-[1.5rem] font-medium leading-tight tracking-[-0.04em] ${loading ? "opacity-40" : ""}`}>
          {estimate?.data?.ready ? reach(estimate.data) : estimate?.data?.blocked ? "Sin calcular" : "—"}
        </p>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          {loading ? "Preguntándole a Meta…" : "Personas al mes, según Meta"}
        </p>
        {estimate?.data ? (
          <>
            <p className="mt-3 text-[13px] leading-6 text-[#1d1d1f]">{estimate.data.summary}</p>
            <ul className={`mt-3 space-y-2 ${loading ? "opacity-40" : ""}`}>
              {estimate.data.notes.map((note) => (
                <ToneLine key={note.text} tone={note.tone}>
                  {note.text}
                </ToneLine>
              ))}
            </ul>
          </>
        ) : estimate?.error ? (
          <p className="mt-3 text-[13px] leading-6 text-[var(--admin-danger)]">{estimate.error}</p>
        ) : null}
      </aside>
    </div>
  );
}

function reach(estimate: AdsEstimate) {
  const short = (value: number) =>
    value >= 1_000_000
      ? `${(value / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`
      : value >= 10_000
        ? `${Math.round(value / 1000).toLocaleString("es-CO")} mil`
        : value.toLocaleString("es-CO");
  if (estimate.upper <= 1000) return "Menos de 1.000";
  return `${short(estimate.lower)} – ${short(estimate.upper)}`;
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <SectionTitle title={title} hint={hint} />
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`${CHIP} ${on ? ON : OFF}`}>
      {children}
    </button>
  );
}

function AgeSelect({ label, value, onChange }: { label: string; value: number; onChange: (next: number) => void }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-9 rounded-full bg-[var(--admin-field)] px-3 text-[13.5px] text-[#1d1d1f]"
    >
      {AGES.map((age) => (
        <option key={age} value={age}>
          {age === AGE_MAX ? "65 o más" : age}
        </option>
      ))}
    </select>
  );
}

function Removable({ pick, onRemove }: { pick: AdsPick; onRemove: () => void }) {
  return (
    <span className={`${CHIP} ${ON}`}>
      {pick.name}
      <button type="button" onClick={onRemove} aria-label={`Quitar ${pick.name}`} className="-mr-1 px-1 text-[#c7c7cc]">
        ×
      </button>
    </span>
  );
}

function PickRow({
  options,
  selected,
  onToggle,
}: {
  options: Option[];
  selected: AdsPick[];
  onToggle: (option: Option) => void;
}) {
  if (options.length === 0) {
    return <p className="mt-2 text-[13px] text-[var(--admin-muted)]">Todavía no hay audiencias en la cuenta.</p>;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((option, index) => {
        const on = Boolean(option.id) && selected.some((item) => item.id === option.id);
        return (
          <button
            key={option.id || `pending-${index}`}
            type="button"
            aria-pressed={on}
            disabled={option.disabled}
            title={option.note}
            onClick={() => onToggle(option)}
            className={`${CHIP} ${on ? ON : OFF}`}
          >
            {option.name}
            <span className={on ? "text-[#aeaeb2]" : "text-[var(--admin-muted)]"}>{option.note}</span>
          </button>
        );
      })}
    </div>
  );
}

function ModeCard({
  on,
  title,
  text,
  onClick,
  disabled,
}: {
  on: boolean;
  title: string;
  text: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-[0.95rem] p-3.5 text-left transition disabled:opacity-45 ${
        on ? "bg-[#1d1d1f] text-white" : "bg-[var(--admin-field)] text-[#1d1d1f] hover:bg-[#e8e8ed]"
      }`}
    >
      <span className="block text-[14px] font-medium">{title}</span>
      <span className={`mt-1 block text-[12.5px] leading-5 ${on ? "text-[#c7c7cc]" : "text-[var(--admin-muted)]"}`}>
        {text}
      </span>
    </button>
  );
}

/** Buscador con espera: pregunta a Meta cuando se deja de escribir. */
function SearchAdd<T>({
  placeholder,
  url,
  pick,
  rowKey,
  render,
  onPick,
}: {
  placeholder: string;
  url: (q: string) => string;
  pick: (data: unknown) => T[];
  rowKey: (row: T) => string;
  render: (row: T) => ReactNode;
  onPick: (row: T) => void;
}) {
  const api = useAdsApi();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; rows: T[]; error: string } | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void api.call<unknown>(url(q)).then((result) => {
        if (cancelled) return;
        setFound({ q, rows: result.ok ? pick(result.data) : [], error: result.ok ? "" : result.error });
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `url` y `pick` son funciones estables por uso; la búsqueda depende solo del texto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, q]);

  const current = q.length >= 2 && found?.q === q ? found : null;

  return (
    <div>
      <input
        className={INPUT}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {q.length >= 2 ? (
        <div className="mt-2 overflow-hidden rounded-[0.8rem] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
          {!current ? (
            <p className="px-3 py-2.5 text-[13px] text-[var(--admin-muted)]">Buscando…</p>
          ) : current.error ? (
            <p className="px-3 py-2.5 text-[13px] text-[var(--admin-danger)]">{current.error}</p>
          ) : current.rows.length === 0 ? (
            <p className="px-3 py-2.5 text-[13px] text-[var(--admin-muted)]">Meta no encontró nada con ese nombre.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-black/[0.05] overflow-y-auto">
              {current.rows.map((row) => (
                <li key={rowKey(row)}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2.5 text-left text-[13.5px] text-[#1d1d1f] hover:bg-[var(--admin-field)]"
                    onClick={() => {
                      onPick(row);
                      setQuery("");
                    }}
                  >
                    {render(row)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
