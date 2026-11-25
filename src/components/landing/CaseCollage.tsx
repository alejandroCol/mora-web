"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { CASE_PRODUCT, casePath } from "@/lib/cases";
import { PromoPrice } from "@/components/promo/PromoPrice";
import { useCaseColors, usePricing } from "@/components/sales/SalesProvider";

export function CaseCollage() {
  const stage = useRef<HTMLDivElement>(null);
  const price = usePricing().case;
  const colors = useCaseColors();

  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let played = false;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (played || !entry.isIntersecting || entry.intersectionRatio < 0.45) return;
        played = true;
        root.classList.add("case-collage-stage-in");
        seen.disconnect();
      },
      { threshold: [0.45] },
    );
    seen.observe(root);
    return () => seen.disconnect();
  }, []);

  return (
    <section id="case" className="case-collage snap-page">
      <Link href={casePath()} className="case-collage-link">
        <div className="case-collage-copy">
          <p className="case-collage-kicker">{CASE_PRODUCT.line}</p>
          <h2 className="case-collage-name">{CASE_PRODUCT.name}</h2>
          <p className="case-collage-finishes">
            <span className="sr-only">
              {colors.map((item) => item.title).join(", ")}
            </span>
            <span className="world-dots" aria-hidden>
              {colors.map((item) => (
                <span key={item.id} className="world-dot" style={{ background: item.swatch }} />
              ))}
            </span>
          </p>
          <div className="case-collage-dock">
            <span className="case-collage-price">
              <PromoPrice value={price} />
            </span>
            <span className="elegir-cta">
              Ver
              <span aria-hidden className="elegir-cta-arrow">
                ›
              </span>
            </span>
          </div>
        </div>
        <div ref={stage} className="case-collage-stage" aria-hidden>
          {colors.map((item, index) => (
            <span
              key={item.id}
              className={`case-collage-tile case-collage-tile-${index}`}
            >
              <span className="case-collage-tile-inner">
                <Image
                  src={item.src}
                  alt=""
                  fill
                  unoptimized
                  quality={100}
                  sizes="(min-width: 1024px) 18vw, 42vw"
                  className="object-cover"
                />
              </span>
            </span>
          ))}
        </div>
      </Link>
    </section>
  );
}
