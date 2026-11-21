import type { ShippingQuoteOption } from "@/commerce/types";
import { normalizeGeoKey } from "@/lib/colombiaGeo";

const DROPI_API = "https://api.dropi.co/integrations/";
const DROPI_GUIDES = "https://api.dropi.co/guias/";
const DROPI_FILES = "https://d39ru7awumhhs2.cloudfront.net/";

/**
 * El token de Mis Integraciones es de tipo WooCommerce y Dropi solo lo acepta si la
 * llamada se presenta como WordPress. Decisión del dueño de la cuenta (2026-11-21).
 * Cuando Dropi entregue un token para software propio, se cambia aquí (o con
 * DROPI_USER_AGENT) y nada más.
 */
const DROPI_USER_AGENT = "WordPress/6.6; https://moraring.com";

/** Producto del catálogo de Dropi que viaja en cada guía de anillos (Mora Ultra). */
const DEFAULT_RING_PRODUCT_ID = "2331406";
/** Cali: la bodega de Dropi desde la que sale el producto. */
const DEFAULT_ORIGIN_DANE = "76001000";

const CARRIER_LABELS: Record<string, string> = {
  veloces: "Veloces",
  envia: "Envía",
  interrapidisimo: "Interrapidísimo",
  domina: "Domina",
  coordinadora: "Coordinadora",
  tcc: "TCC",
  servientrega: "Servientrega",
  "99minutos": "99minutos",
  wiilog: "Wiilog",
};

type DropiEnvelope = {
  isSuccess?: boolean;
  status?: number;
  message?: string;
  error?: string;
  objects?: unknown;
};

function integrationKey() {
  return process.env.DROPI_INTEGRATION_KEY?.trim() ?? "";
}

export function dropiConfigured() {
  return Boolean(integrationKey());
}

export function dropiRingProductId() {
  return Number(process.env.DROPI_RING_PRODUCT_ID?.trim() || DEFAULT_RING_PRODUCT_ID);
}

export function dropiOriginDane() {
  return process.env.DROPI_ORIGIN_DANE?.trim() || DEFAULT_ORIGIN_DANE;
}

export function dropiCarrierLabel(carrier: string) {
  const key = carrier.trim().toLowerCase();
  return CARRIER_LABELS[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Dropi");
}

/** «ENTREGADO A TRANSPORTADORA» → «Entregado a transportadora». */
export function dropiStatusLabel(status: string) {
  const text = status.replace(/_/g, " ").trim().toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Sin estado";
}

async function dropiFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<DropiEnvelope> {
  const key = integrationKey();
  if (!key) throw new Error("Falta DROPI_INTEGRATION_KEY.");
  const res = await fetch(`${DROPI_API}${path}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json;charset=UTF-8",
      "dropi-integration-key": key,
      "User-Agent": process.env.DROPI_USER_AGENT?.trim() || DROPI_USER_AGENT,
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let data: DropiEnvelope = {};
  try {
    data = text ? (JSON.parse(text) as DropiEnvelope) : {};
  } catch {
    data = { isSuccess: false, message: text.slice(0, 280) };
  }
  if (!data.status) data.status = res.status;
  if (data.isSuccess === undefined) data.isSuccess = res.ok && Boolean(text);
  return data;
}

function envelopeMessage(data: DropiEnvelope, fallback: string) {
  const message = [data.message, data.error].find((value) => typeof value === "string" && value.trim());
  if (data.status === 401) return "Dropi rechazó el acceso. Revisa el token de la integración.";
  return typeof message === "string" ? message.trim() : fallback;
}

type QuoteRow = {
  transportadora?: string;
  transportadora_minuscula?: string;
  transportadora_id?: number;
  error?: string;
  objects?: { precioEnvio?: number | null; seguroEnvio?: number | null; trayecto?: string };
};

/** Flete sin recaudo por transportadora. `service` lleva el id que Dropi pide al crear la orden. */
export async function quoteDropi(input: {
  destinationDane: string;
  declaredValue: number;
}): Promise<ShippingQuoteOption[]> {
  const data = await dropiFetch("orders/cotizaEnvioTransportadoraV2", {
    body: {
      EnvioConCobro: false,
      amount: Math.max(1, Math.round(input.declaredValue)),
      ciudad_destino: { cod_dane: input.destinationDane },
      ciudad_remitente: { cod_dane: dropiOriginDane() },
    },
  });
  if (!data.isSuccess || !Array.isArray(data.objects)) {
    throw new Error(envelopeMessage(data, "Dropi no pudo cotizar el envío."));
  }
  return (data.objects as QuoteRow[])
    .filter(
      (row) =>
        row.transportadora_id &&
        !row.error &&
        typeof row.objects?.precioEnvio === "number" &&
        row.objects.precioEnvio > 0,
    )
    .map((row) => {
      const carrier = String(row.transportadora_minuscula || row.transportadora || "").toLowerCase();
      const seguro = row.objects?.seguroEnvio ?? 0;
      return {
        carrier,
        carrierLabel: dropiCarrierLabel(carrier),
        service: String(row.transportadora_id),
        serviceDescription: 
          seguro > 0 ? `Seguro $${Math.round(seguro).toLocaleString("es-CO")}` : undefined,
        totalPriceCop: Math.round(row.objects?.precioEnvio ?? 0),
      };
    })
    .sort((a, b) => a.totalPriceCop - b.totalPriceCop);
}

type DropiDepartment = { id: number; name: string; department_code?: string | null };
type DropiCity = { id: number; name: string; cod_dane?: string | null };

let departmentsCache: { expiresAt: number; rows: DropiDepartment[] } | null = null;
const citiesCache = new Map<number, { expiresAt: number; rows: DropiCity[] }>();
const GEO_TTL = 6 * 60 * 60 * 1000;

async function dropiDepartments() {
  if (departmentsCache && departmentsCache.expiresAt > Date.now()) return departmentsCache.rows;
  const data = await dropiFetch("department");
  if (!data.isSuccess || !Array.isArray(data.objects)) {
    throw new Error(envelopeMessage(data, "Dropi no devolvió los departamentos."));
  }
  const rows = data.objects as DropiDepartment[];
  departmentsCache = { expiresAt: Date.now() + GEO_TTL, rows };
  return rows;
}

async function dropiCities(departmentId: number) {
  const cached = citiesCache.get(departmentId);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;
  const data = await dropiFetch("trajectory/bycity", {
    body: { department_id: departmentId, rate_type: "SIN RECAUDO" },
  });
  const rows = ((data.objects as { cities?: DropiCity[] } | undefined)?.cities ?? []) as DropiCity[];
  if (rows.length) citiesCache.set(departmentId, { expiresAt: Date.now() + GEO_TTL, rows });
  return rows;
}

/**
 * Dropi pide departamento y ciudad con sus propios nombres. Se busca por código DANE
 * (Bogotá vive dentro de Cundinamarca en Dropi) y, si no aparece, por nombre.
 */
export async function resolveDropiCity(input: {
  destinationDane: string;
  departamento: string;
  ciudad: string;
}): Promise<{ state: string; city: string }> {
  const departments = await dropiDepartments();
  const code = input.destinationDane.slice(0, 2);
  const deptoKey = normalizeGeoKey(input.departamento);
  const candidates = [
    ...departments.filter((row) => row.department_code === code),
    ...departments.filter((row) => normalizeGeoKey(row.name) === deptoKey),
    ...(code === "11" ? departments.filter((row) => row.department_code === "25") : []),
  ].filter((row, index, all) => all.findIndex((other) => other.id === row.id) === index);

  const cityKey = normalizeGeoKey(input.ciudad);
  let byName: { state: string; city: string } | null = null;
  for (const department of candidates) {
    const cities = await dropiCities(department.id);
    const exact = cities.find((row) => row.cod_dane === input.destinationDane);
    if (exact) return { state: department.name, city: exact.name };
    if (!byName) {
      const named = cities.find((row) => normalizeGeoKey(row.name) === cityKey);
      if (named) byName = { state: department.name, city: named.name };
    }
  }
  if (byName) return byName;
  throw new Error("Dropi no tiene esa ciudad para envíos sin recaudo.");
}

export type DropiProduct = { id: number; type: string; supplierId: number; name: string };

export async function getDropiProduct(productId: number): Promise<DropiProduct> {
  const data = await dropiFetch(`products/v2/${productId}`);
  const row = data.objects as
    | { id?: number; type?: string; user_id?: number; name?: string }
    | undefined;
  if (!data.isSuccess || !row?.id || !row.user_id) {
    throw new Error(envelopeMessage(data, "Dropi no encontró el producto de la guía."));
  }
  return { id: row.id, type: row.type || "SIMPLE", supplierId: row.user_id, name: row.name || "" };
}

export type DropiOrder = {
  id: string;
  status: string;
  guide: string;
  carrier: string;
  sticker: string;
  stickerPath: string;
  shippingAmount: number;
};

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function readOrder(raw: unknown): DropiOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = text(row.id);
  if (!id) return null;
  const company = row.distribution_company as { name?: unknown } | undefined;
  return {
    id,
    status: text(row.status),
    guide: text(row.shipping_guide),
    carrier: text(row.shipping_company) || text(company?.name),
    sticker: text(row.sticker),
    stickerPath: text(row.guia_urls3),
    shippingAmount: Number(row.shipping_amount ?? 0) || 0,
  };
}

/** Crea la orden sin recaudo. Dropi descuenta el flete de la cartera en este paso. */
export async function createDropiOrder(body: Record<string, unknown>): Promise<DropiOrder> {
  const data = await dropiFetch("orders/myorders", { body });
  const order = readOrder(data.objects);
  if (!data.isSuccess || !order) {
    throw new Error(envelopeMessage(data, "Dropi no creó la orden."));
  }
  return order;
}

export async function getDropiOrder(orderId: string): Promise<DropiOrder> {
  const data = await dropiFetch(`orders/myorders/${encodeURIComponent(orderId)}`);
  const order = readOrder(data.objects);
  if (!data.isSuccess || !order) {
    throw new Error(envelopeMessage(data, "Dropi no devolvió la orden."));
  }
  return order;
}

/** Pasa la orden a GUIA_GENERADA: ahí la transportadora asigna el número de guía. */
export async function generateDropiGuide(orderId: string): Promise<DropiOrder> {
  const data = await dropiFetch(`orders/myorders/${encodeURIComponent(orderId)}`, {
    method: "PUT",
    body: { status: "GUIA_GENERADA" },
  });
  if (!data.isSuccess) {
    throw new Error(envelopeMessage(data, "Dropi no generó la guía."));
  }
  const updated = readOrder(data.objects);
  if (updated?.guide) return updated;
  return getDropiOrder(orderId);
}

/** PDF del rótulo. Dropi lo publica en una de estas rutas según la transportadora. */
export async function fetchDropiSticker(orderId: string): Promise<Buffer> {
  const order = await getDropiOrder(orderId);
  const carrier = order.carrier.toLowerCase();
  const urls = [
    order.stickerPath ? `${DROPI_FILES}${order.stickerPath.replace(/^\/+/, "")}` : "",
    order.sticker && carrier ? `${DROPI_GUIDES}${carrier}/${order.sticker}` : "",
    order.sticker ? `${DROPI_GUIDES}${order.sticker}` : "",
  ].filter(Boolean);
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const pdf = Buffer.from(await res.arrayBuffer());
      if (pdf.subarray(0, 5).toString("latin1").startsWith("%PDF")) return pdf;
    } catch (error) {
      console.error("[dropi sticker]", error);
    }
  }
  throw new Error(
    order.guide
      ? `No pudimos traer el rótulo de la guía ${order.guide}. Ábrelo en Dropi › Órdenes.`
      : "Dropi todavía no tiene el rótulo de esta orden.",
  );
}
