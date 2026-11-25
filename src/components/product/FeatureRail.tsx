"use client";

import { useState, type CSSProperties } from "react";
import type { ModelId } from "@/lib/catalog";
import { specHighlights } from "@/lib/productSpec";
import { FeatureSheet, type FeatureTab } from "./FeatureSheet";
import { SpecIcon } from "./SpecIcon";

/**
 * Sobre la foto, arriba a la derecha: cuatro cápsulas de cristal y una de «más».
 * Cada una abre la hoja con el detalle de esa lectura.
 */
export function FeatureRail({ modelId }: { modelId: ModelId }) {
  const [open, setOpen] = useState<FeatureTab | null>(null);
  return (
    <>
      <ul className="feat-rail" aria-label="Lo que lee el anillo">
        {specHighlights.map((item, index) => (
          <li key={item.label} style={{ "--i": index } as CSSProperties}>
            <button
              type="button"
              className="feat-item"
              data-beat={item.icon === "pulse" ? "" : undefined}
              aria-haspopup="dialog"
              onClick={() => setOpen(item.icon as FeatureTab)}
            >
              <SpecIcon id={item.icon} />
              <span>{item.label}</span>
            </button>
          </li>
        ))}
        <li style={{ "--i": specHighlights.length } as CSSProperties}>
          <button
            type="button"
            className="feat-item feat-more"
            aria-haspopup="dialog"
            aria-label="Todo lo que lee el anillo"
            onClick={() => setOpen("more")}
          >
            <svg viewBox="0 0 16 4" aria-hidden>
              <circle cx="2" cy="2" r="1.6" />
              <circle cx="8" cy="2" r="1.6" />
              <circle cx="14" cy="2" r="1.6" />
            </svg>
          </button>
        </li>
      </ul>
      {open ? (
        <FeatureSheet modelId={modelId} tab={open} onTab={setOpen} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}
