"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BRAND } from "@/brand";
import { BrandMarkParticles } from "@/components/brand/BrandMarkParticles";

type SealPhase = "wait" | "done" | "fail";

export function PurchaseSeal({
  phase,
  title,
  detail,
  href,
  orderNumber,
  failHref,
  onRetry,
  retrying = false,
}: {
  phase: SealPhase;
  title: string;
  detail: string;
  href?: string;
  orderNumber?: string;
  failHref?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const router = useRouter();
  const [narrow, setNarrow] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (phase !== "done" || !href) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => router.replace(href),
      reduce ? 1600 : 5600,
    );
    return () => window.clearTimeout(timer);
  }, [phase, href, router]);

  const density =
    phase === "done" ? (narrow ? 520 : 920) : narrow ? 360 : 640;

  return (
    <div
      className={`seal-stage ${phase === "done" ? "seal-stage-done" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="seal-orb">
        <span
          className={`seal-bloom ${phase === "done" ? "" : "seal-bloom-wait"}`}
          aria-hidden
        />
        <BrandMarkParticles
          key={phase}
          asset="mark"
          loop={phase !== "done"}
          density={density}
          className="seal-mark"
          aria-label={BRAND.name}
        />
        {phase === "done" ? (
          <svg className="seal-ring" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="46" transform="rotate(-90 50 50)" />
          </svg>
        ) : null}
        {phase === "done" ? (
          <svg className="seal-ring seal-ring-soft" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="46" transform="rotate(-90 50 50)" />
          </svg>
        ) : null}
      </div>

      <div className="seal-copy">
        {phase === "done" && orderNumber ? (
          <p className="kicker">Pedido {orderNumber}</p>
        ) : (
          <p className="kicker">{phase === "fail" ? "Pago" : "Un momento"}</p>
        )}
        <h1 className="title-name mt-3 text-[2rem] tracking-[-0.045em] text-ink sm:text-[2.6rem]">
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-soft">{detail}</p>
      </div>

      {phase === "done" && href ? (
        <div className="seal-dock">
          <Link href={href} className="elegir-cta w-full max-w-[22rem]">
            Ver mi pedido
            <span aria-hidden className="elegir-cta-arrow">
              ›
            </span>
          </Link>
        </div>
      ) : null}

      {phase === "wait" && onRetry ? (
        <div className="seal-dock">
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="text-[15px] tracking-[-0.016em] text-soft underline underline-offset-4 hover:text-ink disabled:opacity-50"
          >
            {retrying ? "Abriendo el pago…" : "¿Algo salió mal con el pago? Intentar de nuevo"}
          </button>
        </div>
      ) : null}

      {phase === "fail" && (onRetry || failHref) ? (
        <div className="seal-dock">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="elegir-cta w-full max-w-[22rem] disabled:opacity-50"
            >
              {retrying ? "Abriendo el pago…" : "Intentar de nuevo"}
            </button>
          ) : (
            <Link href={failHref!} className="elegir-cta w-full max-w-[22rem]">
              Volver
              <span aria-hidden className="elegir-cta-arrow">
                ›
              </span>
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
