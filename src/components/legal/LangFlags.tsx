"use client";

import type { ComponentType } from "react";
import type { LegalLang } from "./lang";

function FlagCo() {
  return (
    <svg
      viewBox="0 0 30 20"
      className="h-4 w-6 shrink-0 overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1px_rgba(22,20,31,0.12)]"
      aria-hidden
    >
      <rect width="30" height="10" fill="#FCD116" />
      <rect y="10" width="30" height="5" fill="#003893" />
      <rect y="15" width="30" height="5" fill="#CE1126" />
    </svg>
  );
}

function FlagUs() {
  return (
    <svg
      viewBox="0 0 30 20"
      className="h-4 w-6 shrink-0 overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1px_rgba(22,20,31,0.12)]"
      aria-hidden
    >
      <rect width="30" height="20" fill="#B22234" />
      <g fill="#fff">
        <rect y="1.54" width="30" height="1.54" />
        <rect y="4.62" width="30" height="1.54" />
        <rect y="7.69" width="30" height="1.54" />
        <rect y="10.77" width="30" height="1.54" />
        <rect y="13.85" width="30" height="1.54" />
        <rect y="16.92" width="30" height="1.54" />
      </g>
      <rect width="12.5" height="10.77" fill="#3C3B6E" />
    </svg>
  );
}

const OPTIONS: { id: LegalLang; label: string; name: string; Flag: ComponentType }[] = [
  { id: "es", label: "ES", name: "Español", Flag: FlagCo },
  { id: "en", label: "EN", name: "English", Flag: FlagUs },
];

export function LangFlags({
  lang,
  onChange,
}: {
  lang: LegalLang;
  onChange: (lang: LegalLang) => void;
}) {
  return (
    <div
      role="group"
      aria-label={lang === "es" ? "Idioma" : "Language"}
      className="inline-flex items-center gap-0.5 rounded-full border border-line bg-white/70 p-1 shadow-[0_10px_28px_rgba(22,20,31,0.06)] backdrop-blur-md"
    >
      {OPTIONS.map((option) => {
        const active = lang === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            aria-label={option.name}
            title={option.name}
            onClick={() => onChange(option.id)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition ${
              active ? "bg-lilac shadow-[0_1px_4px_rgba(22,20,31,0.08)]" : "hover:bg-white"
            }`}
          >
            <option.Flag />
            <span
              className={`text-[11px] font-medium tracking-[0.08em] ${
                active ? "text-ink" : "text-soft"
              }`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
