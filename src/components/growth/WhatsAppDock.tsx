"use client";

import { usePathname } from "next/navigation";
import { useWhatsAppLink } from "@/growth/useWhatsAppLink";
import { useMoraStore } from "@/lib/store";

export function WhatsAppDock() {
  const pathname = usePathname();
  const modelId = useMoraStore((state) => state.selection.modelId);
  const { href, onClick, enabled } = useWhatsAppLink(
    `Hola Mora, me interesa Mora ${modelId === "aero" ? "Pro" : "Ultra"}.`,
  );

  if (
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/acceso") ||
    pathname.startsWith("/circulo") ||
    pathname.startsWith("/encuesta") ||
    pathname.startsWith("/anillo") ||
    pathname.startsWith("/galeria") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/pago") ||
    pathname.startsWith("/descargas") ||
    pathname.startsWith("/anim")
  )
    return null;
  if (!enabled) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-50 flex h-12 items-center gap-2 rounded-full bg-[#16141f] px-4 text-[13px] text-white shadow-[0_12px_32px_rgba(22,20,31,0.22)] sm:right-6"
      aria-label="Escribir a Mora por WhatsApp"
    >
      <span aria-hidden>↗</span>
      WhatsApp
    </a>
  );
}
