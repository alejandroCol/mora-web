import { createHash, timingSafeEqual } from "node:crypto";
import type { WompiWidgetConfig } from "@/commerce/wompi";

export type { WompiWidgetConfig };

export type WompiTransaction = {
  id: string;
  amount_in_cents: number;
  reference: string;
  customer_email?: string;
  currency: string;
  payment_method_type?: string;
  status: "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | "PENDING";
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

export function wompiPublicKey() {
  return requiredEnv("NEXT_PUBLIC_WOMPI_PUBLIC_KEY");
}

export function wompiIsConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY?.trim() &&
      process.env.WOMPI_INTEGRITY_SECRET?.trim(),
  );
}

export function wompiEnvironment() {
  const key = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ?? "";
  return key.includes("_prod_") ? "prod" : "test";
}

export function wompiApiBase() {
  return wompiEnvironment() === "prod"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

export function amountToCents(cop: number) {
  return Math.max(0, Math.round(cop)) * 100;
}

export function integritySignature(input: {
  reference: string;
  amountInCents: number;
  currency?: string;
  expirationTime?: string;
}) {
  const secret = requiredEnv("WOMPI_INTEGRITY_SECRET");
  const currency = input.currency ?? "COP";
  const concatenated = input.expirationTime
    ? `${input.reference}${input.amountInCents}${currency}${input.expirationTime}${secret}`
    : `${input.reference}${input.amountInCents}${currency}${secret}`;
  return createHash("sha256").update(concatenated).digest("hex");
}

export function verifyEventChecksum(event: {
  data: Record<string, unknown>;
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number;
}) {
  const secret = process.env.WOMPI_EVENTS_SECRET?.trim();
  if (!secret) return false;
  const properties = event.signature?.properties ?? [];
  const checksum = event.signature?.checksum;
  if (!checksum || !event.timestamp) return false;

  let concatenated = "";
  for (const path of properties) {
    concatenated += String(readPath(event.data, path) ?? "");
  }
  concatenated += String(event.timestamp);
  concatenated += secret;
  const computed = createHash("sha256").update(concatenated).digest("hex");
  const a = Buffer.from(computed.toUpperCase());
  const b = Buffer.from(checksum.toUpperCase());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readPath(root: Record<string, unknown>, path: string) {
  const parts = path.split(".");
  let current: unknown = root;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export async function fetchWompiTransaction(id: string) {
  const privateKey = process.env.WOMPI_PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error("Falta WOMPI_PRIVATE_KEY");
  const res = await fetch(`${wompiApiBase()}/transactions/${id}`, {
    headers: { Authorization: `Bearer ${privateKey}` },
    cache: "no-store",
  });
  const body = (await res.json()) as { data?: WompiTransaction; error?: unknown };
  if (!res.ok || !body.data) {
    throw new Error("No pudimos verificar la transacción en Wompi.");
  }
  return body.data;
}

export function buildWidgetConfig(input: {
  reference: string;
  amountCop: number;
  redirectUrl: string;
  expirationTime?: string;
  customer: WompiWidgetConfig["customerData"];
  shipping: WompiWidgetConfig["shippingAddress"];
}): WompiWidgetConfig {
  const amountInCents = amountToCents(input.amountCop);
  return {
    currency: "COP",
    amountInCents,
    reference: input.reference,
    publicKey: wompiPublicKey(),
    signature: {
      integrity: integritySignature({
        reference: input.reference,
        amountInCents,
        expirationTime: input.expirationTime,
      }),
    },
    redirectUrl: input.redirectUrl,
    expirationTime: input.expirationTime,
    customerData: input.customer,
    shippingAddress: input.shipping,
  };
}
