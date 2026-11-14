import { formatCount } from "@/ads/format";
import { OPEN_AGE_FLOOR_MAX, describeSegment, sanitizeSegment } from "@/ads/segment";
import type { AdsEstimate, AdsInterestOption, AdsPlace, AdsSegment } from "@/ads/types";
import { loadGrowthSettings } from "../growthSettings";
import { MetaAdsError, graphOne } from "./graph";

type Spec = Record<string, unknown>;

/**
 * Traduce la segmentación de Mora a `targeting` de Meta.
 *
 * Dos modos, y la diferencia importa:
 *  - Exacta (`strict`): Meta no se sale de edad, sexo, intereses ni audiencias.
 *  - Abierta: es Advantage+ audience. Edad, sexo, intereses y audiencias son un
 *    punto de partida y Meta puede ampliarlos si encuentra a quien convierte.
 *    Meta solo deja fijar el piso de edad (18 a 25); el tope queda en 65.
 * En los dos modos los lugares y las exclusiones se respetan siempre.
 */
export function toTargetingSpec(input: AdsSegment): Spec {
  const segment = sanitizeSegment(input);
  const spec: Spec = {};

  const cities = segment.places.filter((place) => place.type === "city");
  const regions = segment.places.filter((place) => place.type === "region");
  if (segment.scope === "places" && segment.places.length > 0) {
    const geo: Spec = {};
    if (cities.length > 0) {
      geo.cities = cities.map((city) =>
        city.radiusKm ? { key: city.key, radius: city.radiusKm, distance_unit: "kilometer" } : { key: city.key },
      );
    }
    if (regions.length > 0) geo.regions = regions.map((region) => ({ key: region.key }));
    spec.geo_locations = geo;
  } else {
    spec.geo_locations = { countries: [segment.country] };
  }

  if (segment.strict) {
    spec.age_min = segment.ageMin;
    spec.age_max = segment.ageMax;
    spec.targeting_automation = { advantage_audience: 0 };
  } else {
    spec.age_min = Math.min(segment.ageMin, OPEN_AGE_FLOOR_MAX);
    spec.age_max = 65;
    spec.age_range = [segment.ageMin, segment.ageMax];
    spec.targeting_automation = { advantage_audience: 1 };
  }

  if (segment.gender === "women") spec.genders = [2];
  if (segment.gender === "men") spec.genders = [1];

  if (segment.interests.length > 0) {
    spec.flexible_spec = [{ interests: segment.interests.map((item) => ({ id: item.id, name: item.name })) }];
  }
  if (segment.include.length > 0) spec.custom_audiences = segment.include.map((item) => ({ id: item.id }));
  if (segment.exclude.length > 0) {
    spec.excluded_custom_audiences = segment.exclude.map((item) => ({ id: item.id }));
  }

  if (segment.placement === "instagram") spec.publisher_platforms = ["instagram"];
  if (segment.placement === "facebook") spec.publisher_platforms = ["facebook"];

  return spec;
}

async function adsToken() {
  const settings = await loadGrowthSettings();
  if (!settings.metaAdsToken || !settings.metaAdAccountId) {
    throw Object.assign(new Error("Conecta la cuenta publicitaria de Meta."), { status: 409 });
  }
  return { token: settings.metaAdsToken, accountId: settings.metaAdAccountId };
}

export async function searchInterests(text: string): Promise<AdsInterestOption[]> {
  const q = text.trim().slice(0, 60);
  if (q.length < 2) return [];
  const { token } = await adsToken();
  const body = await graphOne<{ data?: { id: string; name: string; topic?: string; path?: string[] }[] }>(
    "search",
    { type: "adinterest", q, limit: 12, locale: "es_LA" },
    token,
  );
  return (body.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    topic: row.path?.slice(1, -1).join(" › ") || row.topic || "",
  }));
}

export async function searchPlaces(text: string): Promise<AdsPlace[]> {
  const q = text.trim().slice(0, 60);
  if (q.length < 2) return [];
  const { token } = await adsToken();
  const body = await graphOne<{ data?: { key: string; name: string; type: string; region?: string }[] }>(
    "search",
    {
      type: "adgeolocation",
      q,
      location_types: JSON.stringify(["city", "region"]),
      country_code: "CO",
      limit: 10,
    },
    token,
  );
  return (body.data ?? [])
    .filter((row) => row.type === "city" || row.type === "region")
    .map((row) => ({
      key: row.key,
      name: row.name,
      type: row.type as "city" | "region",
      region: row.region,
      radiusKm: 0,
    }));
}

const ONE_MILLION = 1_000_000;

function people(value: number) {
  if (value >= ONE_MILLION) {
    return `${(value / ONE_MILLION).toLocaleString("es-CO", { maximumFractionDigits: 1 })} millones de`;
  }
  return formatCount(Math.round(value / 100) * 100);
}

/** «13,2 a 15,5 millones de personas», «9.500 a 11.200 personas». */
function span(lower: number, upper: number) {
  if (lower >= ONE_MILLION && upper >= ONE_MILLION) {
    const short = (value: number) => (value / ONE_MILLION).toLocaleString("es-CO", { maximumFractionDigits: 1 });
    return `${short(lower)} a ${short(upper)} millones de personas`;
  }
  return `${people(lower)} a ${people(upper)} personas`;
}

function andList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/**
 * Cuánta gente cabe en la segmentación, preguntándole a Meta con el mismo
 * `targeting` que se publicaría. Si Meta rechaza el spec, el aviso sale aquí
 * y no después de crear la campaña.
 */
export async function estimateSegment(input: AdsSegment): Promise<AdsEstimate> {
  const segment = sanitizeSegment(input);
  const notes: AdsEstimate["notes"] = [];
  const summary = describeSegment(segment);

  if (segment.scope === "places" && segment.places.length === 0) {
    return {
      lower: 0,
      upper: 0,
      ready: false,
      summary,
      blocked: true,
      notes: [{ tone: "warn", text: "Elegiste «solo algunos lugares» pero no hay ninguno. Agrega una ciudad o un departamento." }],
    };
  }

  const { token, accountId } = await adsToken();
  let lower = 0;
  let upper = 0;
  let ready = false;
  let blocked = false;
  try {
    const body = await graphOne<{
      data?: { estimate_mau_lower_bound?: number; estimate_mau_upper_bound?: number; estimate_ready?: boolean }[];
    }>(
      `${accountId}/delivery_estimate`,
      { optimization_goal: "REACH", targeting_spec: JSON.stringify(toTargetingSpec(segment)) },
      token,
    );
    const row = body.data?.[0];
    lower = Number(row?.estimate_mau_lower_bound ?? 0) || 0;
    upper = Number(row?.estimate_mau_upper_bound ?? 0) || 0;
    ready = Boolean(row?.estimate_ready) && upper > 0;
  } catch (error) {
    blocked = true;
    notes.push({
      tone: "warn",
      text: `Meta no acepta esta segmentación: ${error instanceof MetaAdsError ? error.message : "no respondió"}`,
    });
  }

  const remarketing = segment.include.length > 0;
  if (ready) {
    if (upper <= 1_000) {
      notes.push({
        tone: "warn",
        text: remarketing
          ? "Meta reconoce menos de 1.000 personas en esas audiencias. Para mostrarles anuncios es muy poca gente (se agota en días y sale cara); sirven mejor para excluir o como base de una audiencia parecida."
          : "Caben menos de 1.000 personas. Meta casi no puede mostrar un anuncio a un grupo tan pequeño: amplía lugares, edad o quita filtros.",
      });
    } else if (upper < 100_000 && !remarketing) {
      notes.push({
        tone: "warn",
        text: `Es angosta (${span(lower, upper)}). Para buscar clientes nuevos se agota rápido y el costo sube. Agrega ciudades, abre la edad o quita intereses.`,
      });
    } else if (lower >= 8 * ONE_MILLION && segment.interests.length === 0 && !remarketing) {
      notes.push({
        tone: "info",
        text: `Es amplia (${span(lower, upper)}). Sirve si el video deja claro para quién es: Meta aprende sola a quién mostrarlo. Si el presupuesto es bajo, un par de intereses la enfocan.`,
      });
    } else {
      notes.push({ tone: "good", text: `Caben ${span(lower, upper)} al mes.` });
    }
  }

  if (!segment.strict) {
    const loose = [
      "la edad",
      segment.gender !== "all" ? "el sexo" : "",
      segment.interests.length > 0 ? "los intereses" : "",
      remarketing ? "las audiencias" : "",
    ].filter(Boolean);
    notes.push({
      tone: remarketing ? "warn" : "info",
      text: remarketing
        ? "Está en «Abierta»: Meta puede mostrarlo a gente que no está en tus audiencias. Para remarketing usa «Exacta»."
        : `Está en «Abierta»: Meta toma ${andList(loose)} como punto de partida y puede salirse si encuentra a quien compra. Los lugares y las exclusiones sí se respetan siempre.`,
    });
    if (segment.ageMin > OPEN_AGE_FLOOR_MAX) {
      notes.push({
        tone: "info",
        text: `En «Abierta» Meta no deja poner el piso de edad en ${segment.ageMin}: el piso real queda en ${OPEN_AGE_FLOOR_MAX} y ${segment.ageMin}–${segment.ageMax} va como sugerencia. Si necesitas que nadie menor de ${segment.ageMin} lo vea, usa «Exacta».`,
      });
    }
  }

  if (segment.exclude.length === 0 && !remarketing) {
    notes.push({
      tone: "info",
      text: "No excluyes a nadie. Si excluyes a «Clientes», no pagas por mostrarle el anuncio a quien ya compró.",
    });
  }

  return { lower, upper, ready, summary, blocked, notes };
}
