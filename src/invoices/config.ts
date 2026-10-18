const DEFAULT_API_BASE = "https://api-v2.matias-api.com/api/ubl2.1";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function envInt(name: string, fallback: number) {
  const raw = env(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export type MatiasConfig = {
  apiBaseUrl: string;
  email: string;
  password: string;
  resolutionNumber: string;
  prefix: string;
  docNumberMin: number;
  docNumberMax: number;
  cityId: string;
  postalCode: string;
  meansElectronic: number;
  defaultMobile: string;
  withVat: boolean;
};

export function matiasConfig(): MatiasConfig | null {
  const email = env("MATIAS_EMAIL");
  const password = env("MATIAS_PASSWORD");
  const resolutionNumber = env("MATIAS_RESOLUTION_NUMBER");
  const prefix = env("MATIAS_PREFIX").replace(/\.+$/, "");
  const docNumberMin = envInt("MATIAS_DOC_NUMBER_MIN", 0);
  const docNumberMax = envInt("MATIAS_DOC_NUMBER_MAX", 0);
  if (!email || !password || !resolutionNumber || !prefix) return null;
  if (docNumberMin <= 0 || docNumberMax < docNumberMin) return null;

  return {
    apiBaseUrl: (env("MATIAS_API_BASE_URL") || DEFAULT_API_BASE).replace(/\/+$/, ""),
    email,
    password,
    resolutionNumber,
    prefix,
    docNumberMin,
    docNumberMax,
    cityId: env("MATIAS_DEFAULT_CITY_ID") || "149",
    postalCode: env("MATIAS_DEFAULT_POSTAL_CODE") || "110111",
    meansElectronic: envInt("MATIAS_MEANS_PAYMENT_ELECTRONIC", 49),
    defaultMobile: env("MATIAS_DEFAULT_MOBILE") || "3000000000",
    withVat: env("MATIAS_INVOICE_WITH_VAT") !== "0",
  };
}

export function matiasIsConfigured() {
  return matiasConfig() != null;
}
