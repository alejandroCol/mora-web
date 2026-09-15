"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { whatsappHref } from "@/growth/attribution";
import { track } from "@/growth/track";
import type { PublicGrowthConfig } from "@/growth/types";
import { useMoraStore } from "@/lib/store";

export function WhatsAppDock() {
  const pathname = usePathname();
  const [config, setConfig] = useState<PublicGrowthConfig | null>(null);
  const selection = useMoraStore((state) => state.selection);

  useEffect(() => {
    void fetch("/api/growth/config")
      .then((res) => res.json())
      .then((data: { config?: PublicGrowthConfig }) => {
        if (data.config) setConfig(data.config);
      })
      .catch(() => undefined);
  }, []);

  if (pathname.startsWith("/superadmin") || pathname.startsWith("/acceso")) return null;
  if (!config?.whatsappDisplayNumber) return null;

  const prefill =
    config.whatsappPrefill ||
    `Hola Mora, me interesa ${selection.modelId === "aero" ? "Aero" : "Titan"}.`;

  return (
    <a
      href={whatsappHref(config.whatsappDisplayNumber, prefill)}
      target="_blank"
      rel="noreferrer"
      onClick={() =>
        track(
          "Contact",
          { content_name: "WhatsApp", content_category: "whatsapp" },
          undefined,
        )
      }
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-50 flex h-12 items-center gap-2 rounded-full bg-[#16141f] px-4 text-[13px] text-white shadow-[0_12px_32px_rgba(22,20,31,0.22)] sm:right-6"
      aria-label="Escribir a Mora por WhatsApp"
    >
      <span aria-hidden>↗</span>
      WhatsApp
    </a>
  );
}
