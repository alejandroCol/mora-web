import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  BOLD_CHECKOUT_SRC,
  BOLD_CURRENCY,
  BOLD_VOUCHER_API,
  type BoldCheckoutConfig,
  type BoldCheckoutSession,
  type BoldDocumentType,
  type BoldEnvironment,
  type BoldVoucher,
  type CreateBoldSessionInput,
} from "./types";

export { BOLD_CHECKOUT_SRC, BOLD_CURRENCY, BOLD_VOUCHER_API };
export type { BoldCheckoutConfig, BoldCheckoutSession, BoldVoucher };

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function requiredEnv(name: string) {
  const value = env(name);
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

export function boldEnvironment(): BoldEnvironment {
  return "prod";
}

export async function resolveBoldEnvironment(): Promise<BoldEnvironment> {
  const { isPaymentsLive } = await import("@/server/paymentsPolicy");
  return (await isPaymentsLive()) ? "prod" : "test";
}

export function boldIdentityKey(environment: BoldEnvironment = "prod") {
  return environment === "prod"
    ? requiredEnv("BOLD_IDENTITY_KEY")
    : requiredEnv("BOLD_TEST_IDENTITY_KEY");
}

export function boldSecretKey(environment: BoldEnvironment = "prod") {
  return environment === "prod"
    ? requiredEnv("BOLD_SECRET_KEY")
    : requiredEnv("BOLD_TEST_SECRET_KEY");
}

export function boldIsConfigured(environment: BoldEnvironment = "prod") {
  if (environment === "prod") {
    return Boolean(env("BOLD_IDENTITY_KEY") && env("BOLD_SECRET_KEY"));
  }
  return Boolean(env("BOLD_TEST_IDENTITY_KEY") && env("BOLD_TEST_SECRET_KEY"));
}

export function newBoldReference(prefix = "MORA") {
  const stamp = Date.now().toString(36).toUpperCase();
  const entropy = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}_${stamp}_${entropy}`.slice(0, 60);
}

export function colombianMobile(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length >= 12) return digits.slice(-10);
  return digits.slice(-10);
}

export function boldDocumentType(value: string | undefined): BoldDocumentType | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized === "PP" || normalized === "PASAPORTE") return "PA";
  const allowed: BoldDocumentType[] = ["CC", "CE", "PA", "NIT", "TI"];
  return allowed.includes(normalized as BoldDocumentType)
    ? (normalized as BoldDocumentType)
    : "CC";
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Hash de integridad del botón de pagos.
 * SHA256(orderId + amount + currency + secretKey)
 * @see https://developers.bold.co/pagos-en-linea/boton-de-pagos/integracion-manual/integracion-manual
 */
export function integritySignature(input: {
  orderId: string;
  amountCop: number;
  currency?: string;
  environment?: BoldEnvironment;
}) {
  const secret = boldSecretKey(input.environment ?? "prod");
  const currency = input.currency ?? BOLD_CURRENCY;
  return sha256Hex(`${input.orderId}${input.amountCop}${currency}${secret}`);
}

function equalHex(left: string, right: string) {
  const a = Buffer.from(left.trim().toLowerCase());
  const b = Buffer.from(right.trim().toLowerCase());
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

function webhookSecrets(environment: BoldEnvironment) {
  if (environment === "test") {
    const testSecret = env("BOLD_TEST_SECRET_KEY");
    return testSecret ? ["", testSecret] : [""];
  }
  return [boldSecretKey("prod")];
}

/**
 * Firma del webhook: HMAC-SHA256(base64(rawBody), secret).
 * En pruebas Bold firma con secreto vacío (snippet oficial).
 * @see https://developers.bold.co/webhook
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  environment: BoldEnvironment = "prod",
) {
  if (!header) return false;
  const encoded = Buffer.from(rawBody, "utf8").toString("base64");
  return webhookSecrets(environment).some((secret) => {
    const hashed = createHmac("sha256", secret).update(encoded).digest("hex");
    return equalHex(hashed, header);
  });
}

function httpsUrl(origin: string, path: string) {
  try {
    const url = new URL(path, `${origin.replace(/\/$/, "")}/`);
    if (url.hostname === "127.0.0.1") url.hostname = "localhost";
    if (url.protocol !== "https:") return undefined;
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

function compactCheckout(
  config: BoldCheckoutConfig,
): BoldCheckoutConfig {
  return Object.fromEntries(
    Object.entries(config).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  ) as BoldCheckoutConfig;
}

export function buildCheckoutConfig(
  input: CreateBoldSessionInput & {
    reference: string;
    origin: string;
    environment?: BoldEnvironment;
  },
): BoldCheckoutConfig {
  const environment = input.environment ?? "prod";
  if (!boldIsConfigured(environment)) throw new Error("Bold aún no está configurado.");
  const origin = input.origin.replace(/\/$/, "");
  const amountCop = Math.max(0, Math.round(input.amountCop));
  return compactCheckout({
    orderId: input.reference,
    currency: BOLD_CURRENCY,
    amount: String(amountCop),
    apiKey: boldIdentityKey(environment),
    integritySignature: integritySignature({
      orderId: input.reference,
      amountCop,
      environment,
    }),
    description: (input.description ?? "Pedido Mora").slice(0, 100),
    redirectionUrl: httpsUrl(origin, "/pago"),
    renderMode: "embedded",
  });
}

export function toCheckoutSession(
  input: CreateBoldSessionInput & {
    reference: string;
    origin: string;
    environment?: BoldEnvironment;
  },
): BoldCheckoutSession {
  return {
    reference: input.reference,
    amountCop: Math.round(input.amountCop),
    currency: BOLD_CURRENCY,
    purpose: input.purpose,
    redirectPath: input.redirectPath,
    checkout: buildCheckoutConfig(input),
    metadata: input.metadata ?? {},
  };
}

export async function fetchBoldVoucher(
  orderId: string,
  environment: BoldEnvironment = "prod",
): Promise<BoldVoucher> {
  if (!orderId.trim()) throw new Error("Falta la referencia de Bold.");
  const res = await fetch(`${BOLD_VOUCHER_API}/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `x-api-key ${boldIdentityKey(environment)}` },
    cache: "no-store",
  });
  const body = (await res.json()) as BoldVoucher & { message?: string };
  if (!res.ok) {
    throw new Error("No pudimos verificar el pago en Bold.");
  }
  return body;
}

export function requestOrigin(request: Request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin
  );
}
