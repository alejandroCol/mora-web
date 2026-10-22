"use client";

import type { ReactNode } from "react";
import { sizeCopy } from "@/commerce/sizing";
import type { SizingMethod } from "@/commerce/types";
import {
  finishLabel,
  finishes,
  products,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { useLookPhoto } from "./useLookPhoto";

type Line = {
  modelId: ModelId;
  finishId: FinishId;
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
  return (
    <span className={`ring-thumb ring-thumb-${size}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </span>
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
  const model = products[line.modelId];
  return (
    <div className={`cart-line ${compact ? "cart-line-compact" : ""}`}>
      <RingThumb
        modelId={line.modelId}
        finishId={line.finishId}
        size={compact ? "sm" : "md"}
      />
      <div className="cart-line-body">
        <div className="cart-line-row">
          <p className="cart-line-name">
            Mora {model.name}
            {line.qty && line.qty > 1 ? ` ×${line.qty}` : ""}
          </p>
          {price ? <p className="cart-line-price">{price}</p> : null}
        </div>
        <p className="cart-line-meta">
          <span className="ring-dot" style={{ background: finishes[line.finishId].swatch }} />
          {finishLabel(line.modelId, line.finishId)}
          <span aria-hidden className="cart-line-sep">
            ·
          </span>
          {sizeCopy(line)}
        </p>
        {children}
      </div>
    </div>
  );
}
