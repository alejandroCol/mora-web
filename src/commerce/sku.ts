import { CASE_PRODUCT, caseLineKey, isCaseColorId } from "@/lib/cases";
import {
  finishLabel,
  isModelId,
  products,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { isCaseLine, lineFinishTitle, lineName, lineUnitPrice } from "./lines";
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
  if (!Number.isInteger(size) || size <= 0) return null;
  return { modelId, finishId, size };
}

export function stockSku(line: {
  kind?: string;
  modelId: string;
  finishId: string;
  size: number;
  sizing?: SizingMethod;
}) {
  if (isCaseLine(line) || !isModelId(line.modelId)) return null;
  if (isSizePending(line)) return null;
  const product = products[line.modelId];
  if (!product?.sizes.includes(line.size) || !product.finishes.includes(line.finishId as FinishId)) {
    return null;
  }
  return inventorySku(line.modelId, line.finishId as FinishId, line.size);
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
  if (isCaseLine(line)) {
    const colorId = isCaseColorId(line.finishId) ? line.finishId : CASE_PRODUCT.colors[0];
    return {
      key: caseLineKey(colorId),
      kind: "case",
      modelId: "case",
      finishId: colorId,
      size: 0,
      sizing: "self",
      qty: Math.max(1, Math.round(line.qty || 1)),
    };
  }
  if (!isModelId(line.modelId)) {
    return normalizeCartLine({ ...line, kind: "case", modelId: "case" });
  }
  const sizing: SizingMethod = line.sizing ?? "self";
  const size = sizing === "kit" ? line.size || PENDING_SIZE : line.size;
  return {
    ...line,
    kind: "ring",
    modelId: line.modelId,
    sizing,
    size,
    key: cartLineKey(line.modelId, line.finishId as FinishId, size, sizing),
  };
}

export function lineToOrderItem(line: CartLine): OrderItem {
  const normalized = normalizeCartLine(line);
  if (isCaseLine(normalized)) {
    return {
      ...normalized,
      sku: "",
      name: lineName(normalized),
      finishTitle: lineFinishTitle(normalized),
      unitPrice: lineUnitPrice(normalized),
    };
  }
  const model = products[normalized.modelId as ModelId];
  return {
    ...normalized,
    sku: stockSku(normalized) ?? "",
    name: `Mora ${model.name}`,
    finishTitle: finishLabel(normalized.modelId as ModelId, normalized.finishId as FinishId),
    unitPrice: model.price,
  };
}

export function availableUnits(units: number, reserved: number) {
  return Math.max(0, Math.round(units) - Math.round(reserved));
}
