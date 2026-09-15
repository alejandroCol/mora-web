"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { captureAttribution } from "@/growth/attribution";
import { eventId } from "@/growth/track";
import type { PublicGrowthConfig } from "@/growth/types";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

function installPixel(pixelId: string) {
  if (typeof window === "undefined") return;
  if (window.fbq) {
    window.fbq("init", pixelId);
    return;
  }
  const stub = function (...args: unknown[]) {
    const self = stub as typeof stub & {
      callMethod?: (...a: unknown[]) => void;
      queue: unknown[];
    };
    if (self.callMethod) {
      self.callMethod(...args);
      return;
    }
    self.queue.push(args);
  };
  const fbq = stub as typeof stub & {
    queue: unknown[];
    loaded: boolean;
    version: string;
    callMethod?: (...a: unknown[]) => void;
  };
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  window.fbq("init", pixelId);
}

export function GrowthStack() {
  const pathname = usePathname();
  const [config, setConfig] = useState<PublicGrowthConfig | null>(null);
  const lastPath = useRef("");

  useEffect(() => {
    void fetch("/api/growth/config")
      .then((res) => res.json())
      .then((data: { config?: PublicGrowthConfig }) => {
        if (data.config) setConfig(data.config);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    captureAttribution();
  }, [pathname]);

  useEffect(() => {
    if (!config?.pixelId) return;
    installPixel(config.pixelId);
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const eid = eventId();
    window.fbq?.("track", "PageView", {}, { eventID: eid });
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "PageView",
        eventId: eid,
        attribution: captureAttribution(),
        url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [config?.pixelId, pathname]);

  return null;
}
