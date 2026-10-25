"use client";

import { useState } from "react";
import { finishLabel, productColorPath, type FinishId, type ModelId } from "@/lib/catalog";
import { siteOrigin } from "@/lib/site";

export function ShareProduct({
  modelId,
  finishId,
  name,
  className = "",
}: {
  modelId: ModelId;
  finishId: FinishId;
  name: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const color = finishLabel(modelId, finishId);

  async function share() {
    const path = productColorPath(modelId, finishId);
    const origin = typeof window === "undefined" ? siteOrigin() : window.location.origin;
    const url = `${origin}${path}`;
    const title = `Mora ${name} · ${color}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={`grid h-10 w-10 place-items-center rounded-full border border-black/[0.06] bg-white/90 text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-md transition-[transform,background-color] hover:bg-white active:scale-95 ${className}`}
      aria-label={copied ? "Enlace copiado" : `Compartir ${color}`}
    >
      {copied ? <CopiedMark /> : <ShareMark />}
    </button>
  );
}

function ShareMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none">
      <path d="M5.6 7.1 10.4 4.5M5.6 8.9l4.8 2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="11.9" cy="3.7" r="1.9" fill="currentColor" />
      <circle cx="4.1" cy="8" r="1.9" fill="currentColor" />
      <circle cx="11.9" cy="12.3" r="1.9" fill="currentColor" />
    </svg>
  );
}

function CopiedMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden fill="none">
      <path d="M3.4 8.2 6.5 11.2 12.6 4.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
