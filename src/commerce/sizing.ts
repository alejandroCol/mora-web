import {
  finishLabel,
  finishes,
  isModelId,
  products,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { isCaseLine, lineFinishTitle, lineName } from "./lines";
import type { SizingMethod } from "./types";

export const PENDING_SIZE = 0;

export function isSizePending(line: {
  size?: number;
  sizing?: SizingMethod;
}) {
  return (line.sizing ?? "self") === "kit" && !line.size;
}

export function sizeCopy(line: { size?: number; sizing?: SizingMethod }) {
  if (isSizePending(line)) return "Con medidor";
  if (line.size) return `Talla ${line.size}`;
  return "Talla pendiente";
}

export function orderHasSizer(items: { sizing?: SizingMethod }[]) {
  return items.some((item) => (item.sizing ?? "self") === "kit");
}

export function orderNeedsSize(
  items: { size?: number; sizing?: SizingMethod }[],
) {
  return items.some(isSizePending);
}

export function tallaPath(orderNumber: string) {
  return `/talla/${encodeURIComponent(orderNumber.trim().toUpperCase())}`;
}

export function commerceLineLabel(item: {
  kind?: string;
  name?: string;
  modelId?: ModelId | "case";
  finishTitle?: string;
  finishId?: string;
  size: number;
  sizing?: SizingMethod;
  qty?: number;
}) {
  if (isCaseLine(item)) {
    const parts = [lineName(item), lineFinishTitle(item)].filter(Boolean);
    const qty = item.qty && item.qty > 1 ? ` ×${item.qty}` : "";
    return `${parts.join(" · ")}${qty}`;
  }
  const name =
    item.name ??
    (item.modelId && isModelId(item.modelId) ? `Mora ${products[item.modelId].name}` : "Mora");
  const finish =
    item.finishTitle ??
    (item.modelId && isModelId(item.modelId) && item.finishId
      ? finishLabel(item.modelId, item.finishId as FinishId)
      : item.finishId && item.finishId in finishes
        ? finishes[item.finishId as FinishId].title
        : "");
  const parts = [name, finish, sizeCopy(item)].filter(Boolean);
  const qty = item.qty && item.qty > 1 ? ` ×${item.qty}` : "";
  return `${parts.join(" · ")}${qty}`;
}
