"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { AdsNoteTone } from "@/ads/types";
import { useAdminAuth } from "../AdminAuth";

export const CARD = "rounded-[1.1rem] bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]";
export const BTN_DARK =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] px-4 text-[13px] text-white transition hover:bg-[#3a3a3c] disabled:opacity-45";
export const BTN_SOFT =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-field)] px-4 text-[13px] text-[#1d1d1f] transition hover:bg-[#e8e8ed] disabled:opacity-45";
export const CHIP =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] transition disabled:opacity-45";
export const INPUT =
  "h-10 w-full rounded-[0.8rem] bg-[var(--admin-field)] px-3 text-[14px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:shadow-[0_0_0_2px_rgba(0,0,0,0.12)]";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Llamadas a `/api/admin/ads/*` con la sesión del panel y un error legible siempre. */
export function useAdsApi() {
  const { authorizedFetch } = useAdminAuth();
  const call = useCallback(
    async <T,>(url: string, method = "GET", body?: unknown): Promise<ApiResult<T>> => {
      try {
        const res = await authorizedFetch(url, {
          method,
          headers: body === undefined ? undefined : { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
        if (!res.ok || data.ok === false) return { ok: false, error: data.error || "No se pudo completar." };
        return { ok: true, data };
      } catch {
        return { ok: false, error: "Sin conexión con el servidor." };
      }
    },
    [authorizedFetch],
  );
  return useMemo(() => ({ call }), [call]);
}

/** Las URLs del CDN de Meta caducan: si la imagen falla, queda el recuadro con «Meta». */
export function Thumb({ src, video, className }: { src: string; video: boolean; className: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative shrink-0 overflow-hidden bg-[var(--admin-field)] ${className}`}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-[11px] text-[var(--admin-muted)]">Meta</div>
      )}
      {video && src && !broken ? (
        <span
          className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-[8px] text-white"
          aria-label="Video"
        >
          ▶
        </span>
      ) : null}
    </div>
  );
}

const DOT: Record<AdsNoteTone, string> = {
  good: "bg-[var(--admin-ok)]",
  warn: "bg-[#b45309]",
  info: "bg-[#8e8e93]",
};

export function ToneLine({ tone, children }: { tone: AdsNoteTone; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] leading-6 text-[#1d1d1f]">
      <span className={`mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]}`} aria-hidden />
      <span className="flex-1">{children}</span>
    </li>
  );
}

export function Switch({
  on,
  onChange,
  label,
  hint,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex w-full items-start justify-between gap-4 text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-[14px] text-[#1d1d1f]">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12px] leading-5 text-[var(--admin-muted)]">{hint}</span> : null}
      </span>
      <span
        className={`relative mt-0.5 h-[1.65rem] w-[2.85rem] shrink-0 rounded-full transition ${on ? "bg-[var(--admin-ok)]" : "bg-[#d1d1d6]"}`}
      >
        <span
          className={`absolute top-[0.15rem] h-[1.35rem] w-[1.35rem] rounded-full bg-[var(--admin-card)] shadow transition-all ${on ? "left-[1.35rem]" : "left-[0.15rem]"}`}
        />
      </span>
    </button>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h3 className="text-[15px] font-medium tracking-[-0.02em] text-[#1d1d1f]">{title}</h3>
      {hint ? <p className="mt-1 text-[12.5px] leading-5 text-[var(--admin-muted)]">{hint}</p> : null}
    </div>
  );
}

export function timeLabel(at: number) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(at));
}

export function dateTimeLabel(at: number) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  })
    .format(new Date(at))
    .replace(".", "");
}
