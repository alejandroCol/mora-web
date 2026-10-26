"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { IconCart, IconClose, IconTrash } from "@/components/icons/NavIcons";
import { cartCountLabel, lineUnitPrice } from "@/commerce/lines";
import { catalog, formatMoney, PRODUCT_HOME, productPath } from "@/lib/catalog";
import { useCartCount, useCartSubtotal, useMoraStore } from "@/lib/store";
import { useSales } from "@/components/sales/SalesProvider";
import { CartLineVisual } from "./CartLineVisual";

export function CartDrawer() {
  const router = useRouter();
  const sales = useSales();
  const { cart, cartOpen, closeCart, setQty, removeLine, setModel } = useMoraStore();
  const count = useCartCount();
  const subtotal = useCartSubtotal();
  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen, closeCart]);

  useEffect(() => {
    document.body.style.overflow = cartOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen]);

  return (
    <div
      className={`fixed inset-0 z-[60] ${cartOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!cartOpen}
    >
      <button
        type="button"
        onClick={closeCart}
        className={`absolute inset-0 bg-ink/25 transition-opacity ${
          cartOpen ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Cerrar carrito"
      />
      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-[26rem] flex-col bg-paper shadow-[-24px_0_60px_rgba(22,20,31,0.12)] transition-transform duration-300 ${
          cartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
          <div>
            <p className="kicker">Carrito</p>
            <h2 className="mt-1 text-[1.35rem] tracking-[-0.03em] text-ink">
              {cartCountLabel(count, cart)}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Cerrar carrito"
            className="cart-close"
          >
            <IconClose className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {cart.length === 0 ? (
            <div className="mt-6">
              <ul className="space-y-3">
                {catalog.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-4 rounded-2xl bg-white px-3 py-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={PRODUCT_HOME[item.id].src}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] tracking-[-0.02em] text-ink">
                        Mora {item.name}
                      </span>
                      <span className="mt-0.5 block text-[14px] text-soft">
                        {formatMoney(item.price)}
                      </span>
                    </span>
                    <Link
                      href={productPath(item.id)}
                      onClick={() => {
                        setModel(item.id);
                        closeCart();
                      }}
                      className="cart-suggest-add"
                    >
                      Agregar
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {cart.map((line) => {
                return (
                  <li key={line.key} className="py-5">
                    <CartLineVisual line={line} price={formatMoney(lineUnitPrice(line) * line.qty)}>
                      <div className="cart-line-actions">
                        <div className="flex items-center rounded-full bg-white/80">
                          <button
                            type="button"
                            className="h-8 w-8 text-soft hover:text-ink"
                            onClick={() => setQty(line.key, line.qty - 1)}
                            aria-label="Quitar uno"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-[13px]">{line.qty}</span>
                          <button
                            type="button"
                            className="h-8 w-8 text-soft hover:text-ink"
                            onClick={() => setQty(line.key, line.qty + 1)}
                            aria-label="Añadir uno"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          aria-label="Quitar del carrito"
                          className="cart-trash"
                        >
                          <IconTrash className="h-[18px] w-[18px]" />
                        </button>
                      </div>
                    </CartLineVisual>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {cart.length === 0 ? null : (
        <footer className="border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-soft">Subtotal</span>
            <span className="text-[15px] text-ink">{formatMoney(subtotal)}</span>
          </div>
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={() => {
              if (cart.length === 0) return;
              closeCart();
              router.push("/checkout");
            }}
            className={`elegir-cta mt-4 w-full ${
              cart.length === 0 ? "pointer-events-none opacity-35" : ""
            }`}
          >
            {sales.cta}
            <span aria-hidden className="elegir-cta-arrow">
              ›
            </span>
          </button>
        </footer>
        )}
      </aside>
    </div>
  );
}

export function CartButton() {
  const count = useCartCount();
  const toggleCart = useMoraStore((state) => state.toggleCart);

  return (
    <button
      type="button"
      onClick={toggleCart}
      aria-label={count > 0 ? `Carrito, ${count}` : "Carrito"}
      className="relative text-ink transition-opacity hover:opacity-55"
    >
      <IconCart className="h-[19px] w-[19px] sm:h-5 sm:w-5" />
      {count > 0 ? (
        <span className="absolute -right-2.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-[#5c4d96] px-1 text-[10px] font-medium text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}
