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

export function track(
  name: MetaStandardEvent,
  data: GrowthEventPayload = {},
  user?: { email?: string; phone?: string; firstName?: string },
  id?: string,
) {
  if (typeof window === "undefined") return;
  const attribution = captureAttribution();
  const eid = id ?? eventId();

  window.fbq?.("track", name, { currency: "COP", ...data }, { eventID: eid });

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
