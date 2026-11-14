import type { AdsGender, AdsPick, AdsPlace, AdsPlacement, AdsSegment } from "./types";

/** Radio que Meta acepta alrededor de una ciudad, en km. 0 = solo la ciudad. */
export const RADIUS_MIN = 17;
export const RADIUS_MAX = 80;
export const AGE_MIN = 18;
export const AGE_MAX = 65;
/** Con segmentación abierta Meta no deja poner el piso de edad por encima de 25. */
export const OPEN_AGE_FLOOR_MAX = 25;

export const MAX_PLACES = 25;
export const MAX_INTERESTS = 12;
export const MAX_AUDIENCES = 8;

export const DEFAULT_SEGMENT: AdsSegment = {
  scope: "country",
  country: "CO",
  places: [],
  ageMin: 22,
  ageMax: 50,
  gender: "women",
  interests: [],
  include: [],
  exclude: [],
  strict: false,
  placement: "auto",
};

/** Las seis ciudades donde más se vende, con su área metropolitana. Claves de Meta verificadas. */
export const MAIN_CITIES: AdsPlace[] = [
  { key: "458130", name: "Bogotá", type: "city", region: "Distrito Especial", radiusKm: 25 },
  { key: "474037", name: "Medellín", type: "city", region: "Antioquia", radiusKm: 25 },
  { key: "479542", name: "Cali", type: "city", region: "Valle del Cauca", radiusKm: 25 },
  { key: "457644", name: "Barranquilla", type: "city", region: "Atlántico", radiusKm: 25 },
  { key: "458349", name: "Bucaramanga", type: "city", region: "Santander", radiusKm: 25 },
  { key: "476114", name: "Pereira", type: "city", region: "Risaralda", radiusKm: 25 },
];

export const GENDER_LABEL: Record<AdsGender, string> = {
  all: "Todos",
  women: "Mujeres",
  men: "Hombres",
};

export const PLACEMENT_LABEL: Record<AdsPlacement, string> = {
  auto: "Donde rinda más",
  instagram: "Solo Instagram",
  facebook: "Solo Facebook",
};

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function picks(raw: unknown, max: number): AdsPick[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AdsPick[] = [];
  for (const item of raw) {
    const value = (item ?? {}) as Record<string, unknown>;
    const id = typeof value.id === "string" ? value.id.trim() : "";
    if (!/^\d{5,30}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: typeof value.name === "string" ? value.name.slice(0, 120) : id });
    if (out.length >= max) break;
  }
  return out;
}

function places(raw: unknown): AdsPlace[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AdsPlace[] = [];
  for (const item of raw) {
    const value = (item ?? {}) as Record<string, unknown>;
    const key = typeof value.key === "string" ? value.key.trim() : "";
    const type = value.type === "region" ? "region" : value.type === "city" ? "city" : null;
    if (!type || !/^\d{1,12}$/.test(key) || seen.has(`${type}:${key}`)) continue;
    seen.add(`${type}:${key}`);
    const radius = Number(value.radiusKm) || 0;
    out.push({
      key,
      type,
      name: typeof value.name === "string" ? value.name.slice(0, 80) : key,
      region: typeof value.region === "string" ? value.region.slice(0, 80) : undefined,
      radiusKm: type === "city" && radius > 0 ? clamp(radius, RADIUS_MIN, RADIUS_MAX, RADIUS_MIN) : 0,
    });
    if (out.length >= MAX_PLACES) break;
  }
  return out;
}

/** Limpia lo que llega del navegador: nada de lo que no entienda llega a Meta. */
export function sanitizeSegment(raw: unknown): AdsSegment {
  const value = (raw ?? {}) as Record<string, unknown>;
  const ageMin = clamp(value.ageMin, AGE_MIN, AGE_MAX, DEFAULT_SEGMENT.ageMin);
  const ageMax = clamp(value.ageMax, ageMin, AGE_MAX, Math.max(ageMin, DEFAULT_SEGMENT.ageMax));
  const include = picks(value.include, MAX_AUDIENCES);
  const includeIds = new Set(include.map((item) => item.id));
  return {
    scope: value.scope === "places" ? "places" : "country",
    country: "CO",
    places: places(value.places),
    ageMin,
    ageMax,
    gender: value.gender === "women" || value.gender === "men" ? value.gender : "all",
    interests: picks(value.interests, MAX_INTERESTS),
    include,
    // Una audiencia no puede estar a la vez dentro y fuera: gana la exclusión explícita del otro lado.
    exclude: picks(value.exclude, MAX_AUDIENCES).filter((item) => !includeIds.has(item.id)),
    strict: value.strict === true,
    placement: value.placement === "instagram" || value.placement === "facebook" ? value.placement : "auto",
  };
}

function list(items: string[], max = 3) {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} y ${items.length - max} más`;
}

/** La segmentación en una frase, para leerla antes de gastar. */
export function describeSegment(segment: AdsSegment) {
  const who = segment.gender === "women" ? "Mujeres" : segment.gender === "men" ? "Hombres" : "Personas";
  const where =
    segment.scope === "places" && segment.places.length > 0
      ? `en ${list(
          segment.places.map((place) =>
            place.type === "city" && place.radiusKm ? `${place.name} +${place.radiusKm} km` : place.name,
          ),
        )}`
      : "en toda Colombia";
  const parts = [`${who} de ${segment.ageMin} a ${segment.ageMax} años ${where}`];
  if (segment.interests.length > 0) {
    parts.push(`con interés en ${list(segment.interests.map((item) => item.name.replace(/\s*\(.*\)$/, "")))}`);
  }
  if (segment.include.length > 0) parts.push(`dentro de ${list(segment.include.map((item) => item.name), 2)}`);
  if (segment.exclude.length > 0) parts.push(`sin ${list(segment.exclude.map((item) => item.name), 2)}`);
  if (segment.placement !== "auto") parts.push(segment.placement === "instagram" ? "solo en Instagram" : "solo en Facebook");
  return `${parts.join(", ")}.`;
}
