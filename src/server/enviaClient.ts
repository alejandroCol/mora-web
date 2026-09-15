import {
  codigoDaneEnviaCiudad,
  codigoEnviaDepartamento,
} from "@/lib/colombiaGeo";
import type { EnviaCarrier, ShippingQuoteOption } from "@/commerce/types";

export const ENVIA_SHIPPING_BASE = "https://api.envia.com";
export const ENVIA_CARRIERS_CO: EnviaCarrier[] = [
  "coordinadora",
  "servientrega",
  "deprisa",
];

export const ENVIA_CARRIER_LABELS: Record<EnviaCarrier, string> = {
  coordinadora: "Coordinadora",
  servientrega: "Servientrega",
  deprisa: "Deprisa",
};

export type EnviaAddress = {
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: "CO";
  postalCode: string;
};

export type EnviaPackage = {
  type: "box";
  content: string;
  amount: number;
  declaredValue: number;
  lengthUnit: "CM";
  weightUnit: "KG";
  weight: number;
  dimensions: { length: number; width: number; height: number };
};

type EnviaRateRow = {
  carrier?: string;
  service?: string;
  serviceDescription?: string;
  totalPrice?: number | string;
  deliveryEstimate?: string;
};

export function buildEnviaAddress(input: {
  name: string;
  phone: string;
  street: string;
  departamento: string;
  ciudad: string;
}): EnviaAddress | null {
  const city = codigoDaneEnviaCiudad(input.departamento, input.ciudad);
  const state = codigoEnviaDepartamento(input.departamento, input.ciudad);
  if (!city || !state) return null;
  const phone = input.phone.replace(/\D/g, "").slice(0, 15);
  const street = input.street.trim().slice(0, 500);
  if (!phone || !street) return null;
  return {
    name: input.name.trim().slice(0, 120) || "Mora",
    phone,
    street,
    city,
    state,
    country: "CO",
    postalCode: city,
  };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export async function fetchEnviaRate(
  token: string,
  payload: {
    origin: EnviaAddress;
    destination: EnviaAddress;
    packages: EnviaPackage[];
    carrier: EnviaCarrier;
  },
): Promise<ShippingQuoteOption[]> {
  const res = await fetch(`${ENVIA_SHIPPING_BASE}/ship/rate/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      origin: payload.origin,
      destination: payload.destination,
      packages: payload.packages,
      settings: { currency: "COP" },
      shipment: { type: 1, carrier: payload.carrier },
    }),
  });

  const body = (await readJson(res)) as
    | { data?: EnviaRateRow[]; error?: { message?: string } }
    | null;

  if (!res.ok) return [];

  const rows = body && typeof body === "object" ? (body.data ?? []) : [];
  const opciones: ShippingQuoteOption[] = [];

  for (const row of rows) {
    const carrier = typeof row.carrier === "string" ? row.carrier : payload.carrier;
    const service = typeof row.service === "string" ? row.service : "";
    const priceRaw = row.totalPrice;
    const price =
      typeof priceRaw === "number"
        ? priceRaw
        : typeof priceRaw === "string"
          ? Number.parseFloat(priceRaw)
          : NaN;
    if (!service || !Number.isFinite(price) || price <= 0) continue;
    const carrierKey = carrier.toLowerCase() as EnviaCarrier;
    opciones.push({
      carrier,
      carrierLabel: ENVIA_CARRIER_LABELS[carrierKey] ?? carrier,
      service,
      serviceDescription:
        typeof row.serviceDescription === "string"
          ? row.serviceDescription
          : undefined,
      totalPriceCop: Math.round(price),
      deliveryEstimate:
        typeof row.deliveryEstimate === "string"
          ? row.deliveryEstimate
          : undefined,
    });
  }

  return opciones.sort((a, b) => a.totalPriceCop - b.totalPriceCop);
}

export async function quoteEnviaCarriers(
  token: string,
  input: {
    origin: EnviaAddress;
    destination: EnviaAddress;
    packages: EnviaPackage[];
  },
): Promise<ShippingQuoteOption[]> {
  const results = await Promise.allSettled(
    ENVIA_CARRIERS_CO.map((carrier) =>
      fetchEnviaRate(token, { ...input, carrier }),
    ),
  );
  const merged: ShippingQuoteOption[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") merged.push(...result.value);
  }
  return merged.sort((a, b) => a.totalPriceCop - b.totalPriceCop);
}

export function selectQuoteOption(
  opciones: ShippingQuoteOption[],
  favorite?: string | null,
) {
  if (opciones.length === 0) return undefined;
  const fav = favorite?.trim().toLowerCase();
  if (fav) {
    const match = opciones.find((option) => option.carrier.toLowerCase() === fav);
    if (match) return match;
  }
  return opciones[0];
}
