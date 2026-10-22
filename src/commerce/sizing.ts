import {
  finishLabel,
  finishes,
  products,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import type { SizingMethod } from "./types";

export const PENDING_SIZE = 0;

export function isSizePending(line: {
  size?: number;
  sizing?: SizingMethod;
}) {
  return (line.sizing ?? "self") === "kit" && !line.size;
}

export function sizeCopy(line: { size?: number; sizing?: SizingMethod }) {
  if (isSizePending(line)) return "Medidor primero";
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
  name?: string;
  modelId?: ModelId;
  finishTitle?: string;
  finishId?: FinishId;
  size: number;
  sizing?: SizingMethod;
  qty?: number;
}) {
  const name =
    item.name ??
    (item.modelId ? `Mora ${products[item.modelId].name}` : "Mora");
  const finish =
    item.finishTitle ??
    (item.modelId && item.finishId
      ? finishLabel(item.modelId, item.finishId)
      : item.finishId
        ? finishes[item.finishId].title
        : "");
  const parts = [name, finish, sizeCopy(item)].filter(Boolean);
  const qty = item.qty && item.qty > 1 ? ` ×${item.qty}` : "";
  return `${parts.join(" · ")}${qty}`;
}
