import { codigoDaneEnviaCiudad } from "@/lib/colombiaGeo";
import type { ShippingQuoteOption } from "@/commerce/types";

const HEKA_PROD_API = "https://api.hekaentrega.co";
const HEKA_DEMO_API = "https://apidev.hekaentrega.co";

type HekaEnv = {
  sandbox: boolean;
  base: string;
  apiKey: string;
  email: string;
  password: string;
  warehouseId: string;
};

export const HEKA_CARRIER_LABELS: Record<string, string> = {
  coordinadora: "Coordinadora",
  servientrega: "Servientrega",
  interrapidisimo: "Interrapidísimo",
  tcc: "TCC",
};

export const HEKA_STATUS_LABEL: Record<string, string> = {
  preview: "Pedido",
  created: "Creada",
  generated: "Preparando",
  progress: "En proceso",
  in_office: "En oficina",
  finished: "Entregada",
  novelty: "En novedad",
  returned: "Devuelta",
  annulled: "Anulada",
  deleted: "Eliminada",
};

type HekaEnvelope = {
  code?: number;
  statusCode?: number;
  message?: string;
  response?: unknown;
};

type HekaSession = {
  token: string;
  userId: string;
  expiresAt: number;
};

let sessionCache: (HekaSession & { sandbox: boolean }) | null = null;

async function hekaSandboxEnabled() {
  return true;
}

async function resolveEnv(): Promise<HekaEnv> {
  const sandbox = await hekaSandboxEnabled();
  if (sandbox) {
    return {
      sandbox: true,
      base: process.env.HEKA_DEMO_API?.trim() || HEKA_DEMO_API,
      apiKey: process.env.HEKA_DEMO_API_KEY?.trim() ?? "",
      email: process.env.HEKA_DEMO_EMAIL?.trim() ?? "",
      password: process.env.HEKA_DEMO_PASSWORD?.trim() ?? "",
      warehouseId: process.env.HEKA_DEMO_WAREHOUSE_ID?.trim() ?? "",
    };
  }
  return {
    sandbox: false,
    base: process.env.HEKA_API?.trim() || HEKA_PROD_API,
    apiKey: process.env.HEKA_API_KEY?.trim() ?? "",
    email: process.env.HEKA_EMAIL?.trim() ?? "",
    password: process.env.HEKA_PASSWORD?.trim() ?? "",
    warehouseId: process.env.HEKA_WAREHOUSE_ID?.trim() ?? "",
  };
}

export function hekaQuoteConfigured() {
  return Boolean(
    process.env.HEKA_API_KEY?.trim() || process.env.HEKA_DEMO_API_KEY?.trim(),
  );
}

export async function hekaGuideConfigured() {
  const env = await resolveEnv();
  return Boolean(env.apiKey && env.email && env.password);
}

export async function hekaPreferredWarehouseId() {
  return (await resolveEnv()).warehouseId;
}

async function hekaFetch(
  path: string,
  init: { method?: string; token?: string; body?: unknown; query?: Record<string, string> },
): Promise<HekaEnvelope> {
  const env = await resolveEnv();
  const query = init.query
    ? `?${new URLSearchParams(
        Object.entries(init.query).filter(([, value]) => value !== ""),
      ).toString()}`
    : "";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  else if (env.apiKey) headers["api-key"] = env.apiKey;
  const res = await fetch(`${env.base}${path}${query}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: HekaEnvelope = {};
  try {
    data = text ? (JSON.parse(text) as HekaEnvelope) : {};
  } catch {
    data = { message: text.slice(0, 280) };
  }
  if (!data.code && !data.statusCode) data.statusCode = res.status;
  return data;
}

function envelopeMessage(data: HekaEnvelope) {
  const response = data.response;
  if (response && typeof response === "object" && "errors" in response) {
    const errors = (response as { errors?: Array<{ property?: string; message?: string }> }).errors;
    if (Array.isArray(errors) && errors.length) {
      const text = errors
        .map((error) => [error.property, error.message].filter(Boolean).join(": "))
        .filter(Boolean)
        .join(". ");
      if (text) return text;
    }
  }
  if (response && typeof response === "object" && "message" in response) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  return "Heka no respondió.";
}

function ok(data: HekaEnvelope) {
  return data.code === 200 || data.code === 201;
}

async function login(): Promise<HekaSession> {
  const env = await resolveEnv();
  if (!env.apiKey || !env.email || !env.password) {
    throw new Error(
      env.sandbox
        ? "Faltan HEKA_DEMO_API_KEY, HEKA_DEMO_EMAIL y HEKA_DEMO_PASSWORD."
        : "Faltan HEKA_API_KEY, HEKA_EMAIL y HEKA_PASSWORD.",
    );
  }
  if (sessionCache && sessionCache.sandbox === env.sandbox && sessionCache.expiresAt > Date.now()) {
    return sessionCache;
  }

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "api-key": env.apiKey,
  };
  const attempts = [
    { path: "/api/v1/user/login", body: { email: env.email, password: env.password, channel: "hekaentrega" } },
  ];
  let last = "No se pudo entrar a Heka.";
  for (const attempt of attempts) {
    const res = await fetch(`${env.base}${attempt.path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(attempt.body),
    });
    const data = (await res.json().catch(() => ({}))) as HekaEnvelope;
    if (!ok(data)) {
      last = envelopeMessage(data);
      continue;
    }
    const response = (data.response ?? {}) as {
      token?: string;
      userId?: string;
      _id?: string;
      user?: { _id?: string };
    };
    const token = response.token?.trim();
    const userId = response.userId?.trim() || response._id?.trim() || response.user?._id?.trim() || "";
    if (!token || !userId) {
      last = "Heka entró sin token de vendedor.";
      continue;
    }
    sessionCache = { token, userId, sandbox: env.sandbox, expiresAt: Date.now() + 25 * 60 * 1000 };
    return sessionCache;
  }
  throw new Error(last);
}

export async function hekaSession() {
  return login();
}

type QuoteRow = {
  distributor_id?: string;
  deliveryTime?: string;
  total?: number;
  annotations?: string;
  message?: string;
  id_service?: number;
};

export async function quoteHeka(input: {
  originDepartamento: string;
  originCiudad: string;
  cityOriginDane?: string;
  departamento: string;
  ciudad: string;
  declaredValue: number;
  weightKg: number;
  heightCm: number;
  longCm: number;
  widthCm: number;
}): Promise<ShippingQuoteOption[]> {
  const cityOrigin =
    input.cityOriginDane?.trim() ||
    codigoDaneEnviaCiudad(input.originDepartamento, input.originCiudad);
  const cityDestination = codigoDaneEnviaCiudad(input.departamento, input.ciudad);
  if (!cityOrigin || !cityDestination) return [];

  let token: string | undefined;
  if (await hekaGuideConfigured()) {
    try {
      token = (await login()).token;
    } catch (error) {
      console.error("[heka quote login]", error);
    }
  }

  const quoteBody = {
    city_origin: cityOrigin,
    city_destination: cityDestination,
    type_payment: 3,
    declared_value: Math.max(25000, Math.round(input.declaredValue)),
    weight: input.weightKg,
    height: input.heightCm,
    long: input.longCm,
    width: input.widthCm,
    withshipping_cost: false,
    collection_value: 0,
    version: "1",
  };
  let data = await hekaFetch("/api/v1/shipping/quoter", { token, body: quoteBody });
  if (token && (!ok(data) || !Array.isArray(data.response))) {
    data = await hekaFetch("/api/v1/shipping/quoter", { body: quoteBody });
  }
  if (!ok(data) || !Array.isArray(data.response)) return [];

  return (data.response as QuoteRow[])
    .filter((row) => row.distributor_id && !row.message && typeof row.total === "number")
    .map((row) => {
      const carrier = String(row.distributor_id).toLowerCase();
      const days = row.deliveryTime?.trim();
      return {
        carrier,
        carrierLabel: HEKA_CARRIER_LABELS[carrier] ?? carrier,
        service: String(row.id_service ?? "0"),
        serviceDescription: row.annotations?.trim() || undefined,
        totalPriceCop: Math.max(0, Math.round(row.total ?? 0)),
        deliveryEstimate: days ? `${days} día${days === "1" ? "" : "s"}` : undefined,
      };
    })
    .sort((a, b) => a.totalPriceCop - b.totalPriceCop);
}

export type HekaWarehouse = {
  id: string;
  name: string;
  dane: string;
  city: string;
  departamento: string;
};

export async function listHekaWarehouses(): Promise<HekaWarehouse[]> {
  const session = await login();
  const data = await hekaFetch("/api/v1/warehouse", {
    method: "GET",
    token: session.token,
    query: { user: session.userId, limit: "100", isnotstatus: "locked" },
  });
  if (!ok(data)) throw new Error(envelopeMessage(data));
  const response = data.response as {
    rows?: Array<{
      _id?: string;
      name?: string;
      status?: string;
      city?: { label?: string; dane?: string; state?: { label?: string } };
    }>;
  } | undefined;
  return (response?.rows ?? [])
    .filter((row) => row._id && row.status !== "disabled" && row.status !== "locked")
    .map((row) => ({
      id: String(row._id),
      name: row.name?.trim() || "Bodega",
      dane: String(row.city?.dane ?? "").trim(),
      city: row.city?.label?.trim() || "",
      departamento: row.city?.state?.label?.trim() || "",
    }));
}

export type HekaGuide = {
  id: string;
  number: string;
  status: string;
};

function readGuide(raw: unknown): HekaGuide | null {
  if (typeof raw === "string") {
    const number = raw.trim();
    if (!number || number.length > 40) return null;
    return { id: "", number, status: "created" };
  }
  if (!raw || typeof raw !== "object") return null;
  const guide = raw as Record<string, unknown>;
  const id = String(guide._id ?? guide.id ?? "").trim();
  const guideField = guide.guide;
  const number = String(
    guide.guide_number ??
      (typeof guideField === "string" ? guideField : "") ??
      guide.numeroGuia ??
      guide.number ??
      "",
  ).trim();
  const status = String(guide.status ?? "").trim();
  if (!id && !number) return null;
  return { id, number, status };
}

export async function createHekaGuide(body: Record<string, unknown>): Promise<HekaGuide> {
  const session = await login();
  const data = await hekaFetch("/api/v1/shipments/guide", {
    token: session.token,
    body,
  });
  if (!ok(data)) throw new Error(envelopeMessage(data));
  const response = (data.response ?? {}) as { guide?: unknown; message?: string };
  let guide = readGuide(response);
  if (!guide?.number) {
    const nested = readGuide(response.guide);
    if (nested) guide = { ...nested, id: nested.id || guide?.id || "" };
  }
  if (!guide?.number) {
    throw new Error(response.message || "Heka no devolvió el número de guía.");
  }
  return guide;
}

export async function fetchHekaSticker(guideId: string): Promise<Buffer> {
  const session = await login();
  const data = await hekaFetch("/api/v1/documents/sticker", {
    token: session.token,
    query: { type: "guide" },
    body: { guides: [guideId] },
  });
  if (!ok(data)) throw new Error(envelopeMessage(data));
  const pdf = data.response;
  if (typeof pdf !== "string" || pdf.length < 100) {
    throw new Error("Heka no devolvió el PDF de la guía.");
  }
  return Buffer.from(pdf, "base64");
}

export async function processHekaGuide(guideId: string) {
  const session = await login();
  const data = await hekaFetch("/api/v1/shipments/guide/process", {
    token: session.token,
    body: { status: "progress", user: session.userId, guides: [guideId] },
  });
  if (!ok(data)) throw new Error(envelopeMessage(data));
}

export async function refreshHekaGuide(guideNumber: string): Promise<HekaGuide> {
  const session = await login();
  const data = await hekaFetch(
    `/api/v1/shipments/guide/guide_status/${encodeURIComponent(guideNumber)}`,
    { method: "GET", token: session.token },
  );
  if (!ok(data)) throw new Error(envelopeMessage(data));
  const response = data.response;
  const guide =
    readGuide(response) ??
    readGuide(
      response && typeof response === "object" && "guide" in response
        ? (response as { guide?: unknown }).guide
        : null,
    );
  if (guide) return { ...guide, number: guide.number || guideNumber };
  const status =
    response && typeof response === "object" && "status" in response
      ? String((response as { status?: unknown }).status ?? "")
      : "";
  return { id: "", number: guideNumber, status };
}

export function hekaStatusLabel(status: string) {
  return HEKA_STATUS_LABEL[status] ?? (status || "Sin estado");
}
