import { finishes, products, type FinishId, type ModelId } from "@/lib/catalog";
import type { CartLine, OrderItem } from "./types";

export function inventorySku(modelId: ModelId, finishId: FinishId) {
  return `${modelId}__${finishId}`;
}

export function cartLineKey(
  modelId: ModelId,
  finishId: FinishId,
  size: number,
) {
  return `${modelId}:${finishId}:${size}`;
}

export function lineToOrderItem(line: CartLine): OrderItem {
  const model = products[line.modelId];
  const finish = finishes[line.finishId];
  return {
    ...line,
    sku: inventorySku(line.modelId, line.finishId),
    name: `Mora ${model.name}`,
    finishTitle: finish.title,
    unitPrice: model.price,
  };
}

export function availableUnits(units: number, reserved: number) {
  return Math.max(0, Math.round(units) - Math.round(reserved));
}
