import type { CartLine, OrderItem, OrderTotals } from "./types";
import { lineUnitPrice } from "./lines";
import { lineToOrderItem } from "./sku";

export function demandBySku(lines: CartLine[]) {
  const map = new Map<string, number>();
  for (const line of lines) {
    const item = lineToOrderItem(line);
    if (!item.sku) continue;
    map.set(item.sku, (map.get(item.sku) ?? 0) + item.qty);
  }
  return map;
}

export function subtotalOf(lines: CartLine[]) {
  return lines.reduce((sum, line) => {
    return sum + lineUnitPrice(line) * Math.max(0, Math.round(line.qty));
  }, 0);
}

export function discountOf(
  subtotal: number,
  offer?: { kind: "percent" | "amount"; value: number } | null,
) {
  if (!offer || !Number.isFinite(offer.value) || offer.value <= 0) return 0;
  if (offer.kind === "percent") {
    const pct = Math.min(50, Math.max(1, offer.value));
    return Math.round(subtotal * (pct / 100));
  }
  return Math.min(subtotal, Math.max(0, Math.round(offer.value)));
}

export function totalsOf(
  items: OrderItem[],
  shipping: number,
  discount = 0,
): OrderTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0,
  );
  const envio = Math.max(0, Math.round(shipping));
  const disc = Math.min(subtotal, Math.max(0, Math.round(discount)));
  return {
    subtotal,
    shipping: envio,
    discount: disc,
    total: Math.max(0, subtotal + envio - disc),
  };
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}
