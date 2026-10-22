import { timingSafeEqual } from "node:crypto";
import { absoluteBrandUrl } from "@/brand";
import { formatoDepartamentoEtiqueta } from "@/lib/colombiaGeo";
import type { MoraOrder } from "@/commerce/types";
import {
  ADDI_MAX_COP_DEFAULT,
  ADDI_MIN_COP_DEFAULT,
  addiAmountAllowed,
  addiAllySlug,
} from "./public";
import { colombianMobile } from "./bold";
import type {
  AddiCheckoutSession,
  AddiEnvironment,
  AddiIdType,
  AddiWebhookEvent,
} from "./types";

export { addiAllySlug, addiAmountAllowed, addiWidgetEnabled } from "./public";

type TokenCache = { token: string; exp: number };

const tokenCache: { sandbox: TokenCache | null; prod: TokenCache | null } = {
  sandbox: null,
  prod: null,
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function envInt(name: string, fallback: number) {
  const raw = env(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function addiEnvironment(): AddiEnvironment {
  return "prod";
}

export async function resolveAddiEnvironment(): Promise<AddiEnvironment> {
  const { isPaymentsLive } = await import("@/server/paymentsPolicy");
  return (await isPaymentsLive()) ? "prod" : "sandbox";
}

export function addiMinCop() {
  return envInt("ADDI_MIN_COP", ADDI_MIN_COP_DEFAULT);
}

export function addiMaxCop() {
  return envInt("ADDI_MAX_COP", ADDI_MAX_COP_DEFAULT);
}

export function addiIsConfigured(environment: AddiEnvironment = "prod") {
  const id = environment === "prod" ? env("ADDI_CLIENT_ID") : env("ADDI_CLIENT_ID") || env("ADDI_SANDBOX_CLIENT_ID");
  const secret =
    environment === "prod"
      ? env("ADDI_CLIENT_SECRET")
      : env("ADDI_CLIENT_SECRET") || env("ADDI_SANDBOX_CLIENT_SECRET");
  return Boolean(id && secret);
}

function addiCredentials(environment: AddiEnvironment = "prod") {
  const sandboxId = env("ADDI_SANDBOX_CLIENT_ID") || env("ADDI_CLIENT_ID");
  const sandboxSecret = env("ADDI_SANDBOX_CLIENT_SECRET") || env("ADDI_CLIENT_SECRET");
  const id = environment === "prod" ? env("ADDI_CLIENT_ID") : sandboxId;
  const secret = environment === "prod" ? env("ADDI_CLIENT_SECRET") : sandboxSecret;
  if (!id || !secret) throw new Error("Addi aún no está configurado.");
  return { id, secret };
}

export function addiAuthUrl(environment: AddiEnvironment = "prod") {
  if (env("ADDI_AUTH_URL")) return env("ADDI_AUTH_URL").replace(/\/$/, "");
  return environment === "prod" ? "https://auth.addi.com" : "https://auth.addi-staging.com";
}

export function addiApiUrl(environment: AddiEnvironment = "prod") {
  if (env("ADDI_API_URL")) return env("ADDI_API_URL").replace(/\/$/, "");
  return environment === "prod" ? "https://api.addi.com" : "https://api.addi-staging.com";
}

function addiAudience(environment: AddiEnvironment = "prod") {
  if (env("ADDI_AUDIENCE")) return env("ADDI_AUDIENCE");
  return environment === "prod" ? "https://api.addi.com" : "https://api.addi-staging.com";
}

function stripAccents(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addiCity(ciudad: string) {
  const clean = stripAccents(ciudad);
  if (/bogota/i.test(clean)) return "Bogota D.C";
  return clean.slice(0, 60) || "Bogota D.C";
}

export function addiDocumentType(value: string | undefined): AddiIdType {
  const normalized = (value ?? "CC").trim().toUpperCase();
  if (normalized === "CE") return "CE";
  if (normalized === "NIT") return "NIT";
  if (normalized === "PA" || normalized === "PP" || normalized === "PASAPORTE") return "PP";
  return "CC";
}

function addiAmount(value: number) {
  return `${Math.max(0, Math.round(value)).toFixed(1)}`;
}

async function getAddiToken(environment: AddiEnvironment = "prod") {
  const cached = tokenCache[environment];
  if (cached && cached.exp > Date.now() + 15_000) return cached.token;

  const { id, secret } = addiCredentials(environment);
  const res = await fetch(`${addiAuthUrl(environment)}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      audience: addiAudience(environment),
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || "Addi no entregó el token.");
  }
  tokenCache[environment] = {
    token: body.access_token,
    exp: Date.now() + Math.max(30, Number(body.expires_in ?? 3600)) * 1000,
  };
  return body.access_token;
}

function pickRedirectUrl(res: Response, body: Record<string, unknown> | null) {
  const header = res.headers.get("location") ?? res.headers.get("Location");
  if (header?.startsWith("http")) return header;
  if (!body) return "";
  const links = body._links as { webRedirect?: { href?: string } } | undefined;
  const candidates = [
    body.redirectionUrl,
    body.applicationUrl,
    body.url,
    body.redirectUrl,
    links?.webRedirect?.href,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.startsWith("http")) return candidate;
  }
  return "";
}

function orderItemsForAddi(order: MoraOrder) {
  const payableItems = Math.max(0, order.totals.subtotal - (order.totals.discount ?? 0));
  const raw = order.items.filter((item) => item.qty > 0);
  const listed = raw.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  let remaining = payableItems;
  return raw.map((item, index) => {
    const share =
      index === raw.length - 1
        ? remaining
        : listed > 0
          ? Math.round((item.unitPrice * item.qty * payableItems) / listed)
          : 0;
    remaining -= share;
    const unitPrice = item.qty > 0 ? Math.max(0, Math.round(share / item.qty)) : 0;
    return {
      sku: (item.sku || item.modelId).slice(0, 50),
      name: stripAccents(`${item.name} ${item.finishTitle}`).slice(0, 50) || "Anillo Mora",
      quantity: String(item.qty),
      unitPrice,
      tax: 0,
      category: "jewelry",
      brand: "Mora",
    };
  });
}

function addressOf(order: MoraOrder) {
  return {
    lineOne: stripAccents(order.shipping.direccion).slice(0, 60) || "Colombia",
    city: addiCity(formatoDepartamentoEtiqueta(order.shipping.ciudad)),
    country: "CO" as const,
  };
}

export function orderEligibleForAddi(order: MoraOrder) {
  return addiAmountAllowed(order.totals.total, addiMinCop(), addiMaxCop());
}

export async function createAddiApplication(input: {
  order: MoraOrder;
  reference: string;
  origin: string;
}): Promise<AddiCheckoutSession> {
  const environment = await resolveAddiEnvironment();
  if (!addiIsConfigured(environment)) throw new Error("Addi aún no está configurado.");
  if (!orderEligibleForAddi(input.order)) {
    throw new Error("Este total no califica para pagar con Addi.");
  }

  const phone = colombianMobile(input.order.customer.phone);
  if (!/^3\d{9}$/.test(phone)) {
    throw new Error("Addi pide un celular colombiano de 10 dígitos.");
  }
  const documentNumber = (input.order.customer.documentNumber ?? "").replace(/\D/g, "");
  if (documentNumber.length < 5) {
    throw new Error("Addi pide cédula o NIT.");
  }

  const origin = input.origin.replace(/\/$/, "");
  const address = addressOf(input.order);
  const payload = {
    orderId: input.reference,
    totalAmount: addiAmount(input.order.totals.total),
    shippingAmount: addiAmount(input.order.totals.shipping),
    totalTaxesAmount: "0.0",
    currency: "COP",
    items: orderItemsForAddi(input.order),
    client: {
      idType: addiDocumentType(input.order.customer.documentType),
      idNumber: documentNumber,
      firstName: stripAccents(input.order.customer.firstName).slice(0, 50),
      lastName: stripAccents(input.order.customer.lastName || input.order.customer.firstName).slice(
        0,
        50,
      ),
      email: input.order.customer.email.trim().toLowerCase(),
      cellphone: phone,
      cellphoneCountryCode: "+57",
      address,
    },
    shippingAddress: address,
    billingAddress: address,
    allyUrlRedirection: {
      logoUrl: absoluteBrandUrl("mark"),
      callbackUrl: `${origin}/api/addi/events`,
      redirectionUrl: `${origin}/pago?ref=${encodeURIComponent(input.reference)}`,
    },
  };

  const token = await getAddiToken(environment);
  const res = await fetch(`${addiApiUrl(environment)}/v1/online-applications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    redirect: "manual",
    cache: "no-store",
  });

  const raw = await res.text();
  let body: Record<string, unknown> | null = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      body = null;
    }
  }

  if (res.status >= 400) {
    const message =
      (body && typeof body.message === "string" && body.message) ||
      (body && typeof body.error === "string" && body.error) ||
      "Addi no pudo abrir el crédito.";
    throw new Error(message);
  }

  const redirectUrl = pickRedirectUrl(res, body);
  if (!redirectUrl) {
    throw new Error("Addi no devolvió la página de cuotas.");
  }

  const applicationId =
    (typeof body?.applicationId === "string" && body.applicationId) ||
    (typeof body?.id === "string" && body.id) ||
    undefined;

  return {
    reference: input.reference,
    amountCop: input.order.totals.total,
    currency: "COP",
    purpose: "order",
    redirectPath: `/pedido/${input.order.orderNumber}`,
    redirectUrl,
    applicationId,
    metadata: { orderId: input.order.id, orderNumber: input.order.orderNumber },
  };
}

export async function fetchAddiApplication(orderId: string) {
  const environment = await resolveAddiEnvironment();
  if (!orderId.trim() || !addiIsConfigured(environment)) return null;
  try {
    const token = await getAddiToken(environment);
    const res = await fetch(
      `${addiApiUrl(environment)}/v1/online-applications/${encodeURIComponent(orderId)}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as AddiWebhookEvent & { status?: string };
  } catch {
    return null;
  }
}

export function readAddiWebhookEvent(payload: unknown): {
  reference: string;
  status: string;
  applicationId?: string;
  amountCop?: number;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as AddiWebhookEvent;
  const reference = String(body.orderId ?? body.order_id ?? "").trim();
  const status = String(body.status ?? body.applicationStatus ?? "").trim();
  if (!reference || !status) return null;
  const rawAmount = body.totalAmount ?? body.amount;
  const amountCop =
    rawAmount == null
      ? undefined
      : Math.round(typeof rawAmount === "number" ? rawAmount : Number.parseFloat(String(rawAmount)));
  return {
    reference,
    status,
    applicationId: String(body.applicationId ?? body.application_id ?? body.id ?? "").trim() || undefined,
    amountCop: Number.isFinite(amountCop) ? amountCop : undefined,
  };
}

export function addiWebhookHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Addi-Signature",
  };
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function parseBasicAuth(header: string) {
  if (!header.toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    return { user: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
  } catch {
    return null;
  }
}

export function verifyAddiCallback(request: Request) {
  const user = env("ADDI_WEBHOOK_USER");
  const password = env("ADDI_WEBHOOK_PASSWORD");
  const secret = env("ADDI_WEBHOOK_SECRET");
  if (!user && !password && !secret) return true;

  const header =
    request.headers.get("authorization") ?? request.headers.get("x-addi-signature") ?? "";
  const basic = parseBasicAuth(header);
  if (user && password && basic && safeEqual(basic.user, user) && safeEqual(basic.password, password)) {
    return true;
  }

  const token = header.replace(/^(Bearer|Basic)\s+/i, "").trim();
  if (password && safeEqual(token, password)) return true;
  if (secret && safeEqual(token, secret)) return true;
  return false;
}

export async function addiPublicConfig() {
  const environment = await resolveAddiEnvironment();
  return {
    configured: addiIsConfigured(environment),
    widget: Boolean(addiAllySlug()),
    minCop: addiMinCop(),
    maxCop: addiMaxCop(),
    environment,
  };
}

