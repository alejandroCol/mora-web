/**
 * Cliente MATIAS UBL 2.1. Solo servidor.
 * @see https://docs.matias-api.com/docs/intro/
 */

import type { MatiasConfig } from "./config";

type LoginResponse = {
  access_token?: string;
  expires_at?: string;
  message?: string;
};

export type MatiasInvoicePayload = Record<string, unknown>;

export type MatiasInvoiceResponse = {
  success?: boolean;
  message?: string;
  XmlDocumentKey?: string;
  response?: { IsValid?: string; StatusMessage?: string };
  pdf?: { url?: string };
};

const TOKEN_SKEW_MS = 120_000;
const LOGIN_TIMEOUT_MS = 30_000;
const INVOICE_TIMEOUT_MS = 60_000;

const tokenCache = new Map<string, { token: string; expiresAtMs: number }>();

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.name === "AbortError") {
      throw new Error(`MATIAS: tiempo de espera HTTP (${timeoutMs} ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function parseExpiresAt(raw: string | undefined) {
  if (!raw?.trim()) return Date.now() + 3600_000;
  const iso = raw.trim().replace(" ", "T");
  const t = Date.parse(iso.includes("T") ? iso : `${iso}Z`);
  return Number.isFinite(t) ? t : Date.now() + 3600_000;
}

export async function matiasAccessToken(config: MatiasConfig) {
  const key = `${config.email.toLowerCase()}|${config.apiBaseUrl}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAtMs - TOKEN_SKEW_MS > Date.now()) {
    return cached.token;
  }

  const res = await fetchWithTimeout(
    `${config.apiBaseUrl}/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: config.email,
        password: config.password,
        remember_me: 0,
      }),
    },
    LOGIN_TIMEOUT_MS,
  );
  const body = (await res.json().catch(() => ({}))) as LoginResponse;
  if (!res.ok || !body.access_token) {
    throw new Error(body.message || `MATIAS login ${res.status}`);
  }

  const entry = {
    token: body.access_token,
    expiresAtMs: parseExpiresAt(body.expires_at),
  };
  tokenCache.set(key, entry);
  return entry.token;
}

export async function matiasSendInvoice(
  payload: MatiasInvoicePayload,
  config: MatiasConfig,
): Promise<MatiasInvoiceResponse> {
  const token = await matiasAccessToken(config);
  const res = await fetchWithTimeout(
    `${config.apiBaseUrl}/invoice`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
    INVOICE_TIMEOUT_MS,
  );
  const body = (await res.json().catch(() => ({}))) as MatiasInvoiceResponse;
  if (!res.ok) {
    const dian = body.response?.StatusMessage?.trim();
    throw new Error(body.message || dian || `MATIAS invoice HTTP ${res.status}`);
  }
  return body;
}
