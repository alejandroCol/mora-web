import {
  finishLabel,
  products,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { isSizePending, PENDING_SIZE } from "./sizing";
import type { CartLine, OrderItem, SizingMethod } from "./types";

export function inventorySku(modelId: ModelId, finishId: FinishId, size: number) {
  return `${modelId}__${finishId}__${size}`;
}

export function parseInventorySku(sku: string) {
  const parts = sku.split("__");
  const [modelId, finishId, sizeRaw] = parts as [ModelId, FinishId, string?];
  const product = products[modelId];
  if (!product || !product.finishes.includes(finishId)) return null;
  if (parts.length === 2) return { modelId, finishId, size: null };
  const size = Number(sizeRaw);
  if (!product.sizes.includes(size)) return null;
  return { modelId, finishId, size };
}

export function stockSku(line: {
  modelId: ModelId;
  finishId: FinishId;
  size: number;
  sizing?: SizingMethod;
}) {
  if (isSizePending(line)) return null;
  const product = products[line.modelId];
  if (!product?.sizes.includes(line.size) || !product.finishes.includes(line.finishId)) {
    return null;
  }
  return inventorySku(line.modelId, line.finishId, line.size);
}

export function inventoryLabel(sku: string) {
  const parsed = parseInventorySku(sku);
  if (!parsed) return "ese anillo";
  const name = `Mora ${products[parsed.modelId].name} ${finishLabel(parsed.modelId, parsed.finishId)}`;
  return parsed.size ? `${name} talla ${parsed.size}` : name;
}

export function cartLineKey(
  modelId: ModelId,
  finishId: FinishId,
  size: number,
  sizing: SizingMethod = "self",
) {
  if (sizing === "kit") return `${modelId}:${finishId}:kit`;
  return `${modelId}:${finishId}:${size}`;
}

export function normalizeCartLine(line: CartLine): CartLine {
  const sizing: SizingMethod = line.sizing ?? "self";
  const size = sizing === "kit" ? line.size || PENDING_SIZE : line.size;
  return {
    ...line,
    sizing,
    size,
    key: cartLineKey(line.modelId, line.finishId, size, sizing),
  };
}

export function lineToOrderItem(line: CartLine): OrderItem {
  const model = products[line.modelId];
  const normalized = normalizeCartLine(line);
  return {
    ...normalized,
    sku: stockSku(normalized) ?? "",
    name: `Mora ${model.name}`,
    finishTitle: finishLabel(line.modelId, line.finishId),
    unitPrice: model.price,
  };
}

export function availableUnits(units: number, reserved: number) {
  return Math.max(0, Math.round(units) - Math.round(reserved));
}
