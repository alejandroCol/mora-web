import { products } from "@/lib/catalog";
import type { CartLine, OrderItem, OrderTotals } from "./types";
import { lineToOrderItem } from "./sku";

export function demandBySku(lines: CartLine[]) {
  const map = new Map<string, number>();
  for (const line of lines) {
    const item = lineToOrderItem(line);
    map.set(item.sku, (map.get(item.sku) ?? 0) + item.qty);
  }
  return map;
}

export function subtotalOf(lines: CartLine[]) {
  return lines.reduce((sum, line) => {
    const price = products[line.modelId]?.price ?? 0;
    return sum + price * Math.max(0, Math.round(line.qty));
  }, 0);
}

export function totalsOf(items: OrderItem[], shipping: number): OrderTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0,
  );
  const envio = Math.max(0, Math.round(shipping));
  return {
    subtotal,
    shipping: envio,
    total: subtotal + envio,
  };
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}
