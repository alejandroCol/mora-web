import { CASE_PRODUCT, caseColor } from "@/lib/cases";
import { finishLabel, finishes, isModelId, products, type FinishId } from "@/lib/catalog";
import type { CartLine } from "./types";

export function isCaseLine(line: { kind?: string; modelId?: string }): boolean {
  return line.kind === "case" || line.modelId === "case";
}

export function isRingLine(line: { kind?: string; modelId?: string }): boolean {
  return !isCaseLine(line);
}

export function lineUnitPrice(line: Pick<CartLine, "kind" | "modelId">) {
  if (isCaseLine(line)) return CASE_PRODUCT.price;
  return isModelId(line.modelId) ? products[line.modelId].price : 0;
}

export function lineName(line: {
  kind?: string;
  modelId?: string;
  name?: string;
}) {
  if (line.name) return line.name;
  if (isCaseLine(line)) return `Mora ${CASE_PRODUCT.name}`;
  return isModelId(line.modelId) ? `Mora ${products[line.modelId].name}` : "Mora";
}

export function lineFinishTitle(line: {
  kind?: string;
  modelId?: string;
  finishId?: string;
  finishTitle?: string;
}) {
  if (line.finishTitle) return line.finishTitle;
  if (isCaseLine(line)) return caseColor(line.finishId).title;
  if (isModelId(line.modelId) && isFinishIdSafe(line.finishId)) {
    return finishLabel(line.modelId, line.finishId);
  }
  return "";
}

export function linePhoto(line: Pick<CartLine, "kind" | "modelId" | "finishId">) {
  if (isCaseLine(line)) return caseColor(line.finishId).src;
  return "";
}

export function lineSwatch(line: Pick<CartLine, "kind" | "modelId" | "finishId">) {
  if (isCaseLine(line)) return caseColor(line.finishId).swatch;
  if (isFinishIdSafe(line.finishId)) return finishes[line.finishId].swatch;
  return "#ddd";
}

export function cartHasCase(lines: CartLine[]) {
  return lines.some(isCaseLine);
}

export function cartHasRing(lines: CartLine[]) {
  return lines.some(isRingLine);
}

export function shouldSuggestCase(lines: CartLine[]) {
  return cartHasRing(lines) && !cartHasCase(lines);
}

export function cartCountLabel(count: number, lines: CartLine[]) {
  if (count === 0) return "Vacío";
  const onlyCases = lines.length > 0 && lines.every(isCaseLine);
  if (onlyCases) return count === 1 ? "1 case" : `${count} cases`;
  const onlyRings = lines.length > 0 && lines.every(isRingLine);
  if (onlyRings) return count === 1 ? "1 anillo" : `${count} anillos`;
  return `${count} ${count === 1 ? "pieza" : "piezas"}`;
}

function isFinishIdSafe(value: unknown): value is FinishId {
  return (
    value === "lilac" ||
    value === "white" ||
    value === "black" ||
    value === "gold" ||
    value === "silver"
  );
}
