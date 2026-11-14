"use client";

import { useEffect, useState } from "react";
import { formatAdsMoney, formatCount } from "@/ads/format";
import { MAX_ADS_PER_CAMPAIGN, RECIPES, WEB_EVENT_LABEL, type AdsRecipe } from "@/ads/recipes";
import { DEFAULT_SEGMENT } from "@/ads/segment";
import type {
  AdsCreateOptions,
  AdsCreated,
  AdsEstimate,
  AdsMedia,
  AdsRecipeId,
  AdsSegment,
  AdsWebEvent,
} from "@/ads/types";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { AdsSegmentBuilder } from "./AdsSegmentBuilder";
import { BTN_DARK, BTN_SOFT, CARD, INPUT, SectionTitle, Thumb, useAdsApi } from "./adsUi";

function segmentFor(recipe: AdsRecipe, options: AdsCreateOptions): AdsSegment {
  const pick = (keys: AdsRecipe["include"]) =>
    options.audiences
      .filter((audience) => keys.includes(audience.key) && audience.id)
      .map((audience) => ({ id: audience.id, name: audience.label }));
  return {
    ...DEFAULT_SEGMENT,
    // Remarketing: a quien ya conoce a Mora no se le filtra por edad ni sexo.
    ...(recipe.remarketing ? { gender: "all" as const, ageMin: 18, ageMax: 65, strict: true } : {}),
    include: pick(recipe.include),
    exclude: pick(recipe.exclude),
  };
}

function suggestedName(recipe: AdsRecipe, day: string) {
  return `Mora · ${recipe.label} · ${day}`;
}

/** Armar una campaña: qué busca, con qué publicación, a quién y cuánto. Siempre nace en pausa. */
export function AdsCreatePanel({ onCreated }: { onCreated: () => void }) {
  const api = useAdsApi();
  const [options, setOptions] = useState<AdsCreateOptions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [recipeId, setRecipeId] = useState<AdsRecipeId>("whatsapp");
  const [segment, setSegment] = useState<AdsSegment>(DEFAULT_SEGMENT);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [webEvent, setWebEvent] = useState<AdsWebEvent>("PURCHASE");
  const [estimate, setEstimate] = useState<AdsEstimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<AdsCreated | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.call<{ options: AdsCreateOptions }>("/api/admin/ads/create").then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      const loaded = result.data.options;
      setOptions(loaded);
      setSegment(segmentFor(RECIPES[0], loaded));
      setBudget(String(loaded.defaults.dailyBudget));
      setLink(loaded.defaults.link);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (loadError) return <p className={`${CARD} text-[13px] text-[var(--admin-danger)]`}>{loadError}</p>;
  if (!options) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <BrandLoader label="Leyendo publicaciones y audiencias" />
      </div>
    );
  }

  const recipe = RECIPES.find((item) => item.id === recipeId) ?? RECIPES[0];
  const money = (value: number) => formatAdsMoney(value, options.currency);
  const budgetValue = Math.round(Number(budget.replace(/[^\d]/g, ""))) || 0;
  const day = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" })
    .format(new Date(options.access.checkedAt))
    .replace(".", "");
  const finalName = name.trim() || suggestedName(recipe, day);

  const problems = [
    ...options.blockers,
    mediaIds.length === 0 ? "Elige al menos una publicación." : "",
    budgetValue < options.limits.minDailyBudget ? `El mínimo diario es ${money(options.limits.minDailyBudget)}.` : "",
    options.limits.maxDailyPerCampaign > 0 && budgetValue > options.limits.maxDailyPerCampaign
      ? `Tu tope por campaña es ${money(options.limits.maxDailyPerCampaign)} (se cambia en Piloto).`
      : "",
    recipe.remarketing && segment.include.length === 0
      ? "El remarketing necesita al menos una audiencia en «Mostrarle a». Créalas en Audiencias."
      : "",
    estimate?.blocked ? "La segmentación tiene un problema: mira los avisos." : "",
  ].filter(Boolean);

  function pickRecipe(next: AdsRecipe) {
    setRecipeId(next.id);
    setSegment(segmentFor(next, options!));
    setError("");
  }

  function toggleMedia(media: AdsMedia) {
    setMediaIds((current) =>
      current.includes(media.id)
        ? current.filter((id) => id !== media.id)
        : current.length >= MAX_ADS_PER_CAMPAIGN
          ? current
          : [...current, media.id],
    );
  }

  async function create() {
    const question = `Se crea «${finalName}» en pausa, con ${money(budgetValue)} al día y ${mediaIds.length} ${mediaIds.length === 1 ? "anuncio" : "anuncios"}. No gasta hasta que la prendas. ¿Crear?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError("");
    const result = await api.call<{ created: AdsCreated }>("/api/admin/ads/create", "POST", {
      recipe: recipe.id,
      name: finalName,
      dailyBudget: budgetValue,
      segment,
      mediaIds,
      link,
      webEvent,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreated(result.data.created);
    setMediaIds([]);
    setName("");
  }

  if (created) {
    return (
      <section className={CARD}>
        <h2 className="text-[17px] font-medium tracking-[-0.02em]">Quedó creada, en pausa.</h2>
        <p className="mt-2 text-[14px] leading-6 text-[#1d1d1f]">
          «{created.name}» ya está en Meta con {created.adIds.length}{" "}
          {created.adIds.length === 1 ? "anuncio" : "anuncios"}. Meta los revisa mientras tanto; no gasta nada hasta
          que la prendas en Resultados.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={BTN_DARK} onClick={onCreated}>
            Ir a Resultados
          </button>
          <button type="button" className={BTN_SOFT} onClick={() => setCreated(null)}>
            Crear otra
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      {!options.access.canManage ? (
        <p className={`${CARD} text-[13px] leading-6 text-[#1d1d1f]`}>
          Puedes armarla y ver a cuánta gente le llega, pero para crearla en Meta falta el permiso:{" "}
          <span className="text-[var(--admin-muted)]">{options.access.missing.join(" ")}</span>
        </p>
      ) : null}

      <section className={CARD}>
        <SectionTitle title="1. Qué quieres lograr" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {RECIPES.map((item) => {
            const on = item.id === recipe.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => pickRecipe(item)}
                className={`rounded-[0.95rem] p-4 text-left transition ${
                  on ? "bg-[#1d1d1f] text-white" : "bg-[var(--admin-field)] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                }`}
              >
                <span className="block text-[15px] font-medium tracking-[-0.02em]">{item.label}</span>
                <span className={`mt-1 block text-[13px] leading-5 ${on ? "text-[#e5e5ea]" : "text-[#1d1d1f]"}`}>
                  {item.what}
                </span>
                <span className={`mt-1.5 block text-[12px] leading-5 ${on ? "text-[#aeaeb2]" : "text-[var(--admin-muted)]"}`}>
                  {item.when}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={CARD}>
        <SectionTitle
          title="2. Con qué publicación"
          hint={`Sale tal cual está en Instagram, con sus likes y comentarios. Hasta ${MAX_ADS_PER_CAMPAIGN}: Meta reparte y se queda con la que mejor rinde.`}
        />
        {options.media.length === 0 ? (
          <p className="mt-3 text-[13px] text-[var(--admin-muted)]">
            No se pudieron leer las publicaciones de Instagram. Revisa la conexión en Automatizaciones.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {options.media.map((media) => {
              const on = mediaIds.includes(media.id);
              const full = !on && mediaIds.length >= MAX_ADS_PER_CAMPAIGN;
              return (
                <li key={media.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={!media.eligible || full}
                    onClick={() => toggleMedia(media)}
                    className={`block w-full overflow-hidden rounded-[0.95rem] text-left transition disabled:opacity-40 ${
                      on ? "shadow-[0_0_0_2px_#1d1d1f]" : "shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
                    }`}
                  >
                    <div className="relative">
                      <Thumb src={media.thumbnail} video={media.isVideo} className="aspect-[4/5] w-full" />
                      {on ? (
                        <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#1d1d1f] text-[12px] text-white">
                          {mediaIds.indexOf(media.id) + 1}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-2 text-[12px] leading-4 text-[#1d1d1f]">{media.caption || "Sin texto"}</p>
                      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">
                        ♥ {formatCount(media.likes)} · {formatCount(media.comments)} coment.
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-[var(--admin-muted)]">
                        {!media.eligible
                          ? "Instagram no deja promocionarla"
                          : media.used
                            ? `Como anuncio: ${money(media.used.spend)} · ${formatCount(media.used.chats)} chats${media.used.sales ? ` · ${media.used.sales} ventas` : ""}`
                            : "Nunca ha salido como anuncio"}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={CARD}>
        <SectionTitle title="3. A quién" />
        <div className="mt-4">
          <AdsSegmentBuilder
            value={segment}
            onChange={setSegment}
            audiences={options.audiences}
            others={options.others}
            lockStrict={recipe.remarketing}
            onEstimate={setEstimate}
          />
        </div>
      </section>

      <section className={CARD}>
        <SectionTitle title="4. Cuánto y cómo se llama" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-[12px] text-[var(--admin-muted)]">Presupuesto al día ({options.currency})</span>
            <input
              className={INPUT}
              inputMode="numeric"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
            <span className="text-[11.5px] leading-4 text-[var(--admin-muted)]">
              Entre {money(options.limits.minDailyBudget)} y {money(options.limits.maxDailyPerCampaign)}. Al mes serían
              unos {money(budgetValue * 30)}.
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[12px] text-[var(--admin-muted)]">Nombre</span>
            <input
              className={INPUT}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={suggestedName(recipe, day)}
              maxLength={80}
            />
          </label>
          {recipe.destination === "web" ? (
            <>
              <label className="grid gap-1.5">
                <span className="text-[12px] text-[var(--admin-muted)]">A qué página llega</span>
                <input className={INPUT} value={link} onChange={(event) => setLink(event.target.value)} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[12px] text-[var(--admin-muted)]">Qué le pides a Meta que consiga</span>
                <select
                  className={INPUT}
                  value={webEvent}
                  onChange={(event) => setWebEvent(event.target.value as AdsWebEvent)}
                >
                  {(Object.keys(WEB_EVENT_LABEL) as AdsWebEvent[]).map((event) => (
                    <option key={event} value={event}>
                      {WEB_EVENT_LABEL[event]}
                    </option>
                  ))}
                </select>
                <span className="text-[11.5px] leading-4 text-[var(--admin-muted)]">
                  Meta aprende con unas 50 a la semana. Si aún hay pocas compras, «Agregar al carrito» le da más de dónde
                  aprender.
                </span>
              </label>
            </>
          ) : null}
        </div>
      </section>

      <section className={CARD}>
        <h3 className="text-[15px] font-medium tracking-[-0.02em]">Resumen</h3>
        <p className="mt-2 text-[14px] leading-6 text-[#1d1d1f]">
          {recipe.label}, {money(budgetValue)} al día, con {mediaIds.length || "ninguna"}{" "}
          {mediaIds.length === 1 ? "publicación" : "publicaciones"}. {estimate?.summary ?? ""}
        </p>
        {problems.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {problems.map((problem) => (
              <li key={problem} className="text-[13px] leading-6 text-[#b45309]">
                {problem}
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="mt-3 text-[13px] leading-6 text-[var(--admin-danger)]">{error}</p> : null}
        <button
          type="button"
          className="admin-cta mt-4"
          disabled={busy || problems.length > 0 || !options.access.canManage}
          onClick={() => void create()}
        >
          {busy ? "Creando en Meta…" : "Crear en pausa"}
        </button>
        <p className="mt-2 text-center text-[12px] text-[var(--admin-muted)]">
          Nace apagada. La revisas y la prendes tú desde Resultados.
        </p>
      </section>
    </div>
  );
}
