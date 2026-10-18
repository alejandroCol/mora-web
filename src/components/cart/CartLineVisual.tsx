import type { ReactNode } from "react";
import { sizeCopy } from "@/commerce/sizing";
import type { SizingMethod } from "@/commerce/types";
import {
  finishLabel,
  finishPhoto,
  finishes,
  products,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";

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
  return (
    <span className={`ring-thumb ring-thumb-${size}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={finishPhoto(finishId)} alt="" />
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
    <div className={`flex gap-3.5 ${compact ? "items-center" : "items-start"}`}>
      <RingThumb
        modelId={line.modelId}
        finishId={line.finishId}
        size={compact ? "sm" : "md"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-[15px] leading-5 tracking-[-0.018em] text-ink">
            Mora {model.name}
            {line.qty && line.qty > 1 ? ` ×${line.qty}` : ""}
          </p>
          {price ? (
            <p className="shrink-0 text-[13px] tracking-[-0.016em] text-ink">{price}</p>
          ) : null}
        </div>
        <div className="mt-1.5">
          <ColorChip modelId={line.modelId} finishId={line.finishId} />
        </div>
        <p className="mt-1 text-[12px] leading-4 tracking-[-0.01em] text-soft">
          {sizeCopy(line)}
        </p>
        {children}
      </div>
    </div>
  );
}
