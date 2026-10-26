"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/brand";
import { whatsappHref } from "@/growth/attribution";
import { track } from "@/growth/track";
import type { PublicGrowthConfig } from "@/growth/types";

export function useWhatsAppLink(prefill?: string) {
  const [config, setConfig] = useState<PublicGrowthConfig | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/growth/config")
      .then((res) => res.json())
      .then((data: { config?: PublicGrowthConfig }) => {
        if (alive && data.config) setConfig(data.config);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const enabled = Boolean(config?.whatsappDisplayNumber);
  const text = config?.whatsappPrefill || prefill || "Hola Mora";
  const href = enabled
    ? whatsappHref(config?.whatsappDisplayNumber ?? "", text)
    : BRAND.contact.whatsapp;

  function onClick() {
    track("Contact", { content_name: "WhatsApp", content_category: "whatsapp" });
  }

  return { href, onClick, enabled };
}
