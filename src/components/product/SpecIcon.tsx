import type { ReactNode } from "react";
import type { SpecIconId } from "@/lib/productSpec";

/** Trazos de un mismo peso sobre una rejilla de 24: se leen igual a 15 px que a 20 px. */
const PATHS: Record<SpecIconId, ReactNode> = {
  night: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  pulse: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  ),
  recovery: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  stress: (
    <>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </>
  ),
  sport: (
    <>
      <path d="M10 2h4" />
      <path d="m12 14 3-3" />
      <circle cx="12" cy="14" r="8" />
    </>
  ),
  meditation: (
    <>
      <path d="M12 4.5c2 2.3 3 4.7 3 7.2 0 2.4-1.1 4.5-3 5.8-1.9-1.3-3-3.4-3-5.8 0-2.5 1-4.9 3-7.2Z" />
      <path d="M8.9 9.2c-1.7-.5-3.4-.4-4.9.3.1 4 2.6 7.2 8 8" />
      <path d="M15.1 9.2c1.7-.5 3.4-.4 4.9.3-.1 4-2.6 7.2-8 8" />
      <path d="M6 21h12" />
    </>
  ),
  skin: <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />,
  movement: (
    <>
      <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
      <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" />
      <path d="M16 17h4" />
      <path d="M4 13h4" />
    </>
  ),
  cycle: (
    <>
      <path d="M12 5.5c-2 0-3.6 1.1-3.6 3 0 2.5 1.5 4.3 2.3 5.6v4.4h2.6v-4.4c.8-1.3 2.3-3.1 2.3-5.6 0-1.9-1.6-3-3.6-3Z" />
      <path d="M8.5 7.6C6.8 6.3 4.6 6.2 3.6 7.7c-.6.9-.3 2 .6 2.5" />
      <path d="M15.5 7.6c1.7-1.3 3.9-1.4 4.9.1.6.9.3 2-.6 2.5" />
      <circle cx="6.4" cy="11.4" r="1.3" />
      <circle cx="17.6" cy="11.4" r="1.3" />
    </>
  ),
  bond: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
};

export function SpecIcon({ id, className = "" }: { id: SpecIconId; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[id]}
    </svg>
  );
}
