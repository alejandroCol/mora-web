import { PAYMENT_CHIP_TEXT } from "@/crm/replies";
import { formatMoney, products } from "@/lib/catalog";

/**
 * Atajos de venta: un toque y el texto queda en el mensaje.
 * Es función y no constante: el precio vivo puede cambiar desde Inventario.
 */
export function quickSells() {
  return [
    { id: "pro", label: "Pro", text: `Mora Pro ${formatMoney(products.aero.price)} → https://moraring.com/anillo/pro` },
    { id: "ultra", label: "Ultra", text: `Mora Ultra ${formatMoney(products.titan.price)} → https://moraring.com/anillo/ultra` },
    { id: "talla", label: "Talla", text: "Te mandamos el medidor o te mides aquí: https://moraring.com/talla" },
    { id: "pago", label: "Pagar", text: PAYMENT_CHIP_TEXT },
  ];
}
