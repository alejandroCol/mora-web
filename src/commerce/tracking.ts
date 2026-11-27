import type { MoraOrder, ShipmentKind } from "./types";
import { legFromShipping, ringsTrackingNumber } from "./shipments";
import { orderHasSizer } from "./sizing";

export type CarrierTracking = {
  url: string;
  /** La página ya trae la guía; si no, hay que pegarla allá. */
  prefilled: boolean;
  /** Sin página conocida de la transportadora: búsqueda en Google. */
  search?: boolean;
};

type CarrierPage = { url: (guide: string) => string; prefilled: boolean };

/**
 * Páginas públicas de rastreo (revisadas el 2026-11-27). Las llaves son el
 * `carrier` que guardan Heka, Dropi o Envía, sin tildes ni espacios.
 */
const CARRIER_PAGES: Record<string, CarrierPage> = {
  coordinadora: {
    url: (guide) =>
      `https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia=${encodeURIComponent(guide)}`,
    prefilled: true,
  },
  servientrega: {
    url: (guide) =>
      `https://mobile.servientrega.com/WebSitePortal/RastreoEnvioDetalle.html?Guia=${encodeURIComponent(guide)}`,
    prefilled: true,
  },
  interrapidisimo: { url: () => "https://siguetuenvio.interrapidisimo.com/", prefilled: false },
  tcc: { url: () => "https://tcc.com.co/rastreo/", prefilled: false },
  envia: { url: () => "https://envia.co/rastreo", prefilled: false },
  veloces: { url: () => "https://veloces.co/", prefilled: false },
  domina: { url: () => "https://www.domina.com.co/", prefilled: false },
  "99minutos": { url: () => "https://tracking.99minutos.com/", prefilled: false },
};

function carrierKey(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Dónde rastrear una guía. Sin transportadora conocida, busca la guía en Google. */
export function carrierTracking(guide: string, carrier?: string, carrierLabel?: string): CarrierTracking | null {
  const number = guide.trim();
  if (!number) return null;
  for (const raw of [carrier, carrierLabel]) {
    const page = raw ? CARRIER_PAGES[carrierKey(raw)] : undefined;
    if (page) return { url: page.url(number), prefilled: page.prefilled };
  }
  const query = ["rastrear guía", carrierLabel || carrier, number].filter(Boolean).join(" ");
  return { url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, prefilled: true, search: true };
}

export type LegGuide = {
  kind: ShipmentKind;
  title: string;
  number: string;
  carrierLabel?: string;
  statusLabel?: string;
  tracking: CarrierTracking | null;
};

/** Guía de cada tramo que ya tiene número, en el orden en que viajan. */
export function orderGuides(order: MoraOrder): LegGuide[] {
  const hasSizer = orderHasSizer(order.items);
  const guides: LegGuide[] = [];
  const sizerNumber = order.shipments?.sizer?.trackingNumber?.trim() || "";
  if (sizerNumber) {
    const leg = order.shipments!.sizer!;
    guides.push({
      kind: "sizer",
      title: "Guía del medidor",
      number: sizerNumber,
      carrierLabel: leg.carrierLabel,
      statusLabel: leg.hekaStatusLabel,
      tracking: carrierTracking(sizerNumber, leg.carrier, leg.carrierLabel),
    });
  }
  const ringsNumber = ringsTrackingNumber(order);
  if (ringsNumber && ringsNumber !== sizerNumber) {
    const leg = legFromShipping(order, "rings", order.shipments?.rings?.status ?? "pending");
    guides.push({
      kind: "rings",
      title: hasSizer ? "Guía de los anillos" : "Guía",
      number: ringsNumber,
      carrierLabel: leg.carrierLabel,
      statusLabel: leg.hekaStatusLabel,
      tracking: carrierTracking(ringsNumber, leg.carrier, leg.carrierLabel),
    });
  }
  return guides;
}
