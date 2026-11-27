import divipolaJson from "@/data/colombia-divipola.json";

export type DivipolaRow = {
  cod_dpto: string;
  dpto: string;
  cod_mpio: string;
  nom_mpio: string;
};

const ROWS = divipolaJson as DivipolaRow[];

export const COLOMBIA_DEPARTAMENTOS: readonly string[] = Array.from(
  new Set(ROWS.map((row) => row.dpto)),
).sort((a, b) => a.localeCompare(b, "es"));

export function municipiosDelDepartamento(departamento: string): string[] {
  const d = departamento.trim();
  if (!d) return [];
  const set = new Set<string>();
  for (const row of ROWS) {
    if (row.dpto === d) set.add(row.nom_mpio);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

export function formatoDepartamentoEtiqueta(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function normalizeGeoKey(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function buscarDivipolaMunicipio(
  departamento: string,
  municipio: string,
): DivipolaRow | null {
  const d = departamento.trim();
  const m = municipio.trim();
  if (!d || !m) return null;
  const mk = normalizeGeoKey(m);
  for (const row of ROWS) {
    if (row.dpto !== d) continue;
    if (normalizeGeoKey(row.nom_mpio) === mk) return row;
  }
  return null;
}

/** Como lo escribe la gente → nombre DIVIPOLA, ya con `normalizeGeoKey`. */
const MUNICIPIO_ALIAS: Record<string, string> = {
  bogota: "bogota, d.c.",
  "bogota dc": "bogota, d.c.",
  cali: "santiago de cali",
  cartagena: "cartagena de indias",
  cucuta: "san jose de cucuta",
};

function geoPart(raw: string) {
  return normalizeGeoKey(raw).replace(/\./g, "").trim();
}

let byMunicipio: Map<string, DivipolaRow[]> | null = null;

function rowsByMunicipio(key: string) {
  if (!byMunicipio) {
    byMunicipio = new Map();
    for (const row of ROWS) {
      const name = geoPart(row.nom_mpio);
      byMunicipio.set(name, [...(byMunicipio.get(name) ?? []), row]);
    }
  }
  return byMunicipio.get(key) ?? [];
}

/**
 * Municipio escrito a mano («Medellín», «Cali, Valle», «Bogotá D.C.»). Si el
 * nombre existe en varios departamentos y no dice cuál, devuelve null.
 */
export function buscarMunicipio(texto: string): { departamento: string; ciudad: string } | null {
  const whole = geoPart(texto);
  if (!whole) return null;
  const parts = texto.split(/[,/()]+/).map(geoPart).filter(Boolean);
  const candidates = [whole, ...(parts.length > 1 ? [parts[0]] : [])];
  for (const candidate of candidates) {
    const target = (MUNICIPIO_ALIAS[candidate] ?? candidate).replace(/\./g, "");
    const rows = rowsByMunicipio(target);
    if (rows.length === 0) continue;
    const hint = candidate === whole ? [] : parts.slice(1);
    const named = hint.length
      ? rows.find((row) => hint.some((part) => geoPart(row.dpto).includes(part)))
      : undefined;
    const row = named ?? (new Set(rows.map((item) => item.dpto)).size === 1 ? rows[0] : null);
    return row ? { departamento: row.dpto, ciudad: row.nom_mpio } : null;
  }
  return null;
}

export function codigoDaneEnviaCiudad(
  departamento: string,
  municipio: string,
): string | null {
  const row = buscarDivipolaMunicipio(departamento, municipio);
  if (!row) return null;
  const cod = row.cod_mpio;
  return cod.length >= 8 ? cod.slice(0, 8) : cod.padEnd(8, "0");
}

export function codigoEnviaDepartamento(
  departamento: string,
  municipio: string,
): string | null {
  const row = buscarDivipolaMunicipio(departamento, municipio);
  if (!row) return null;
  return row.cod_dpto === "11" ? "DC" : row.cod_dpto;
}
