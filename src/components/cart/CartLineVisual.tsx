"use client";

import type { ReactNode } from "react";
import { isCaseLine, lineFinishTitle, lineName, linePhoto, lineSwatch } from "@/commerce/lines";
import { sizeCopy } from "@/commerce/sizing";
import type { CatalogId, SizingMethod } from "@/commerce/types";
import {
  finishLabel,
  finishes,
  isModelId,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { useLookPhoto } from "./useLookPhoto";

type Line = {
  kind?: "ring" | "case";
  modelId: CatalogId;
  finishId: string;
  size: number;
  sizing?: SizingMethod;
  qty?: number;
};

export function ColorChip({
  modelId,
  finishId,
}: {
  modelId: ModelId;
  finishId: FinishId;
}) {
  const finish = finishes[finishId];
  return (
    <span className="color-chip">
      <span className="ring-dot" style={{ background: finish.swatch }} aria-hidden />
      {finishLabel(modelId, finishId)}
    </span>
  );
}

export function RingThumb({
  finishId,
  modelId,
  size = "md",
}: {
  finishId: FinishId;
  modelId: ModelId;
  size?: "sm" | "md" | "lg";
}) {
  const src = useLookPhoto(modelId, finishId);
  const finish = finishes[finishId];
  return (
    <span className={`ring-thumb ring-thumb-${size}`} aria-hidden>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="ring-thumb-swatch" style={{ background: finish.swatch }} />
      )}
    </span>
  );
}

function LineThumb({
  line,
  size = "md",
}: {
  line: Line;
  size?: "sm" | "md" | "lg";
}) {
  if (isCaseLine(line)) {
    const src = linePhoto(line);
    return (
      <span className={`ring-thumb ring-thumb-${size}`} aria-hidden>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" />
        ) : (
          <span className="ring-thumb-swatch" style={{ background: lineSwatch(line) }} />
        )}
      </span>
    );
  }
  if (!isModelId(line.modelId)) return null;
  return (
    <RingThumb
      modelId={line.modelId}
      finishId={line.finishId as FinishId}
      size={size}
    />
  );
}

export function CartLineVisual({
  line,
  price,
  children,
  compact = false,
}: {
  line: Line;
  price?: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  const accessory = isCaseLine(line);
  return (
    <div className={`cart-line ${compact ? "cart-line-compact" : ""}`}>
      <LineThumb line={line} size={compact ? "sm" : "md"} />
      <div className="cart-line-body">
        <div className="cart-line-row">
          <p className="cart-line-name">
            {lineName(line)}
            {line.qty && line.qty > 1 ? ` ×${line.qty}` : ""}
          </p>
          {price ? <p className="cart-line-price">{price}</p> : null}
        </div>
        <p className="cart-line-meta">
          <span className="ring-dot" style={{ background: lineSwatch(line) }} />
          {lineFinishTitle(line)}
          {accessory ? null : (
            <>
              <span aria-hidden className="cart-line-sep">
                ·
              </span>
              {sizeCopy(line)}
            </>
          )}
        </p>
        {children}
      </div>
    </div>
  );
}
