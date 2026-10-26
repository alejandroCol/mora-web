"use client";

import type { ReactNode } from "react";
import { useWhatsAppLink } from "@/growth/useWhatsAppLink";

export function WhatsAppLink({
  className,
  children,
  prefill,
}: {
  className?: string;
  children: ReactNode;
  prefill?: string;
}) {
  const { href, onClick } = useWhatsAppLink(prefill);
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={className}>
      {children}
    </a>
  );
}
