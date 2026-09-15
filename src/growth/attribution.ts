import type { AttributionSnapshot } from "./types";

const KEY = "mora-attribution";

function cookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export function readAttribution(): AttributionSnapshot {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AttributionSnapshot;
  } catch {
    return {};
  }
}

export function captureAttribution(): AttributionSnapshot {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const current = readAttribution();
  const next: AttributionSnapshot = { ...current };

  const fbclid = params.get("fbclid");
  if (fbclid) {
    next.fbclid = fbclid;
    next.fbc = `fb.1.${Date.now()}.${fbclid}`;
  }

  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = params.get("utm_campaign");
  const utmContent = params.get("utm_content");
  const utmTerm = params.get("utm_term");
  if (utmSource) next.utmSource = utmSource;
  if (utmMedium) next.utmMedium = utmMedium;
  if (utmCampaign) next.utmCampaign = utmCampaign;
  if (utmContent) next.utmContent = utmContent;
  if (utmTerm) next.utmTerm = utmTerm;

  if (!next.landing) next.landing = window.location.pathname + window.location.search;
  const fbp = cookie("_fbp");
  if (fbp) next.fbp = fbp;
  if (!next.fbp) {
    next.fbp = `fb.1.${Date.now()}.${Math.random().toString(36).slice(2, 12)}`;
  }

  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function whatsappHref(phone: string, prefill: string) {
  const digits = phone.replace(/\D/g, "");
  const text = encodeURIComponent(prefill);
  return `https://wa.me/${digits}${text ? `?text=${text}` : ""}`;
}
