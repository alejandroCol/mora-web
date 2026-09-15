import { COLLECTIONS, DOCS } from "@/commerce/paths";
import type { CommerceSettings, ShippingQuoteOption } from "@/commerce/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { normalizeGeoKey } from "@/lib/colombiaGeo";
import {
  buildEnviaAddress,
  quoteEnviaCarriers,
  selectQuoteOption,
  type EnviaPackage,
} from "./enviaClient";

const DEFAULT_PACKAGE = {
  pesoKg: 0.35,
  largoCm: 18,
  anchoCm: 14,
  altoCm: 6,
};

export const DEFAULT_SETTINGS: CommerceSettings = {
  origin: {
    name: "Mora",
    phone: "",
    departamento: "",
    ciudad: "",
    direccion: "",
  },
  package: DEFAULT_PACKAGE,
  quoteAutomatic: true,
  fallbackShippingCop: 16000,
  cityRates: [],
  updatedAt: 0,
};

export async function loadCommerceSettings(): Promise<CommerceSettings> {
  try {
    const snap = await adminDb().doc(DOCS.commerce).get();
    if (!snap.exists) return DEFAULT_SETTINGS;
    const data = snap.data() as Partial<CommerceSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...data,
      origin: { ...DEFAULT_SETTINGS.origin, ...data.origin },
      package: { ...DEFAULT_SETTINGS.package, ...data.package },
      cityRates: Array.isArray(data.cityRates) ? data.cityRates : [],
    };
  } catch (error) {
    console.error("[commerce settings]", error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveCommerceSettings(
  patch: Partial<CommerceSettings>,
): Promise<CommerceSettings> {
  const current = await loadCommerceSettings();
  const next: CommerceSettings = {
    ...current,
    ...patch,
    origin: { ...current.origin, ...patch.origin },
    package: { ...current.package, ...patch.package },
    cityRates: patch.cityRates ?? current.cityRates,
    updatedAt: Date.now(),
  };
  await adminDb().doc(DOCS.commerce).set(next, { merge: true });
  return next;
}

function staticEnvioCop(
  settings: CommerceSettings,
  ciudad: string,
  departamento: string,
  subtotal: number,
) {
  const umbral = settings.freeShippingFromCop ?? 0;
  if (umbral > 0 && subtotal >= umbral) return 0;
  const cityKey = normalizeGeoKey(ciudad);
  const deptoKey = normalizeGeoKey(departamento);
  const rates = settings.cityRates ?? [];
  const explicit = rates.find(
    (rate) =>
      normalizeGeoKey(rate.ciudad) === cityKey &&
      rate.departamento &&
      normalizeGeoKey(rate.departamento) === deptoKey,
  );
  if (explicit) return Math.max(0, Math.round(explicit.cop));
  const cityOnly = rates.find(
    (rate) =>
      normalizeGeoKey(rate.ciudad) === cityKey && !rate.departamento?.trim(),
  );
  if (cityOnly) return Math.max(0, Math.round(cityOnly.cop));
  return Math.max(0, Math.round(settings.fallbackShippingCop ?? 0));
}

function isAutoQuoteReady(settings: CommerceSettings) {
  if (!settings.quoteAutomatic) return false;
  const origin = settings.origin;
  const pack = settings.package;
  return Boolean(
    origin.departamento.trim() &&
      origin.ciudad.trim() &&
      origin.direccion.trim() &&
      origin.phone.replace(/\D/g, "") &&
      pack.pesoKg > 0 &&
      pack.largoCm > 0 &&
      pack.anchoCm > 0 &&
      pack.altoCm > 0,
  );
}

export type QuoteInput = {
  departamento: string;
  ciudad: string;
  direccion: string;
  nombre?: string;
  telefono?: string;
  subtotal: number;
  piezas: number;
};

export type QuoteResult = {
  envioCop: number;
  fuente: "envia" | "estatico";
  gratis: boolean;
  seleccionada: ShippingQuoteOption | null;
  opciones: ShippingQuoteOption[];
};

const quoteCache = new Map<string, { expiresAt: number; result: QuoteResult }>();

export async function quoteShipping(input: QuoteInput): Promise<QuoteResult> {
  const settings = await loadCommerceSettings();
  const umbral = settings.freeShippingFromCop ?? 0;
  const gratis = umbral > 0 && input.subtotal >= umbral;
  if (gratis) {
    return {
      envioCop: 0,
      fuente: "estatico",
      gratis: true,
      seleccionada: null,
      opciones: [],
    };
  }

  const token = process.env.ENVIA_API_TOKEN?.trim();
  const canQuote = isAutoQuoteReady(settings) && Boolean(token);

  if (!canQuote) {
    const envioCop = staticEnvioCop(
      settings,
      input.ciudad,
      input.departamento,
      input.subtotal,
    );
    return {
      envioCop,
      fuente: "estatico",
      gratis: false,
      seleccionada: null,
      opciones: [],
    };
  }

  const origin = buildEnviaAddress({
    name: settings.origin.name || "Mora",
    phone: settings.origin.phone,
    street: settings.origin.direccion,
    departamento: settings.origin.departamento,
    ciudad: settings.origin.ciudad,
  });
  const destination = buildEnviaAddress({
    name: input.nombre?.trim() || "Cliente",
    phone: input.telefono?.trim() || settings.origin.phone,
    street: input.direccion,
    departamento: input.departamento,
    ciudad: input.ciudad,
  });

  if (!origin || !destination) {
    return {
      envioCop: staticEnvioCop(
        settings,
        input.ciudad,
        input.departamento,
        input.subtotal,
      ),
      fuente: "estatico",
      gratis: false,
      seleccionada: null,
      opciones: [],
    };
  }

  const piezas = Math.max(1, input.piezas);
  const pkg: EnviaPackage = {
    type: "box",
    content: "Anillo Mora",
    amount: 1,
    declaredValue: Math.max(0, Math.round(input.subtotal)),
    lengthUnit: "CM",
    weightUnit: "KG",
    weight: Math.min(30, Math.max(0.1, settings.package.pesoKg * piezas)),
    dimensions: {
      length: settings.package.largoCm,
      width: settings.package.anchoCm,
      height: Math.min(
        80,
        settings.package.altoCm + Math.max(0, piezas - 1) * 2,
      ),
    },
  };

  const key = [
    origin.city,
    destination.city,
    pkg.weight,
    pkg.dimensions.height,
    settings.favoriteCarrier ?? "",
  ].join("|");
  const cached = quoteCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const opciones = await quoteEnviaCarriers(token!, {
    origin,
    destination,
    packages: [pkg],
  });
  const seleccionada = selectQuoteOption(opciones, settings.favoriteCarrier);

  const result: QuoteResult =
    seleccionada != null
      ? {
          envioCop: seleccionada.totalPriceCop,
          fuente: "envia",
          gratis: false,
          seleccionada,
          opciones,
        }
      : {
          envioCop: staticEnvioCop(
            settings,
            input.ciudad,
            input.departamento,
            input.subtotal,
          ),
          fuente: "estatico",
          gratis: false,
          seleccionada: null,
          opciones: [],
        };

  quoteCache.set(key, { expiresAt: Date.now() + 10 * 60 * 1000, result });
  return result;
}
