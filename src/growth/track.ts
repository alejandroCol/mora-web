import { captureAttribution, readAttribution } from "./attribution";
import type { GrowthEventPayload, MetaStandardEvent } from "./types";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function eventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type PixelCall = [string, MetaStandardEvent, Record<string, unknown>, { eventID: string }];

/** Eventos que salen antes de que el Pixel esté instalado (la ficha dispara ViewContent al montar). */
const pending: PixelCall[] = [];

/** Lo llama GrowthStack justo después de instalar el Pixel. */
export function flushPixelQueue() {
  if (typeof window === "undefined" || !window.fbq) return;
  for (const call of pending.splice(0)) window.fbq(...call);
}

export function track(
  name: MetaStandardEvent,
  data: GrowthEventPayload = {},
  user?: { email?: string; phone?: string; firstName?: string },
  id?: string,
) {
  if (typeof window === "undefined") return;
  const attribution = captureAttribution();
  const eid = id ?? eventId();

  const call: PixelCall = ["track", name, { currency: "COP", ...data }, { eventID: eid }];
  if (window.fbq) window.fbq(...call);
  else if (pending.length < 20) pending.push(call);

  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      data,
      eventId: eid,
      attribution,
      user,
      url: window.location.href,
    }),
    keepalive: true,
  }).catch(() => undefined);

  return eid;
}

export function currentAttribution() {
  return readAttribution();
}
