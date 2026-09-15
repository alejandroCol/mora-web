"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IconCart } from "@/components/icons/NavIcons";
import { finishes, formatMoney, products } from "@/lib/catalog";
import { useCartCount, useCartSubtotal, useMoraStore } from "@/lib/store";

export function CartDrawer() {
  const { cart, cartOpen, closeCart, setQty, removeLine } = useMoraStore();
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
              {count === 0 ? "Vacío" : `${count} ${count === 1 ? "anillo" : "anillos"}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="text-[13px] text-soft hover:text-ink"
          >
            Cerrar
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {cart.length === 0 ? (
            <p className="mt-8 text-[15px] leading-7 text-soft">
              Elige un color y una talla. Puedes mezclar varios anillos en el
              mismo pedido.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {cart.map((line) => {
                const model = products[line.modelId];
                const finish = finishes[line.finishId];
                return (
                  <li key={line.key} className="flex gap-4 py-4">
                    <span
                      className="jewel mt-1"
                      style={{ background: finish.swatch }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] text-ink">
                        {model.name} · {finish.title}
                      </p>
                      <p className="mt-0.5 text-[13px] text-soft">Talla {line.size}</p>
                      <div className="mt-3 flex items-center gap-3">
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
                          className="text-[12px] text-soft hover:text-ink"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                    <p className="text-[13px] text-ink">
                      {formatMoney(model.price * line.qty)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-soft">Subtotal</span>
            <span className="text-[15px] text-ink">{formatMoney(subtotal)}</span>
          </div>
          <p className="mt-1 text-[12px] text-soft">El envío se calcula en el checkout, según destino.</p>
          <Link
            href="/checkout"
            onClick={closeCart}
            className={`mt-4 flex h-12 items-center justify-center rounded-full text-[14px] ${
              cart.length === 0
                ? "pointer-events-none bg-ink/20 text-white"
                : "bg-ink text-white hover:opacity-80"
            }`}
          >
            Continuar
          </Link>
        </footer>
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
      aria-label={count > 0 ? `Carrito, ${count} anillos` : "Carrito"}
      className="relative text-ink transition-opacity hover:opacity-55"
    >
      <IconCart className="h-[19px] w-[19px] sm:h-5 sm:w-5" />
      {count > 0 ? (
        <span className="absolute -right-2.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}
