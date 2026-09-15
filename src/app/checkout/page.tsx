"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { cartCount, subtotalOf } from "@/commerce/cartMath";
import { finishes, formatMoney, products } from "@/lib/catalog";
import { useMoraStore } from "@/lib/store";

const RingCanvas = dynamic(
  () => import("@/components/ring/RingCanvas").then((mod) => mod.RingCanvas),
  { ssr: false },
);

export default function CheckoutPage() {
  const cart = useMoraStore((state) => state.cart);
  const selection = useMoraStore((state) => state.selection);
  const preview = cart[0] ?? selection;
  const subtotal = subtotalOf(cart);
  const count = cartCount(cart);

  return (
    <div className="hero-wash min-h-dvh pt-[calc(4.5rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-xl px-6 pb-16 lg:max-w-6xl">
        <Link href="/#reservar" className="text-[13px] text-soft hover:text-ink">
          ← Anillos
        </Link>

        <div className="mt-6 grid items-start gap-8 lg:mt-8 lg:grid-cols-[0.7fr_1.1fr] lg:gap-16">
          <div className="hidden lg:block">
            <div className="h-[26rem]">
              <RingCanvas
                configure
                finishId={preview.finishId}
                className="h-full w-full"
              />
            </div>
            {cart.length > 0 ? (
              <ul className="mt-6 space-y-2 text-[13px] text-soft">
                {cart.map((line) => (
                  <li key={line.key} className="flex justify-between text-ink">
                    <span>
                      {products[line.modelId].name} · {finishes[line.finishId].title} · #
                      {line.size}
                      {line.qty > 1 ? ` ×${line.qty}` : ""}
                    </span>
                    <span>{formatMoney(products[line.modelId].price * line.qty)}</span>
                  </li>
                ))}
                <li className="flex justify-between pt-2 text-soft">
                  <span>
                    {count} {count === 1 ? "anillo" : "anillos"}
                  </span>
                  <span>{formatMoney(subtotal)}</span>
                </li>
              </ul>
            ) : null}
          </div>

          <div className="mx-auto w-full max-w-[22rem] lg:mx-0 lg:max-w-none">
            <p className="kicker">Checkout</p>
            <h1 className="mt-2 text-[1.85rem] font-medium tracking-[-0.04em] text-ink sm:text-[2.1rem]">
              Tres pasos.
            </h1>
            <p className="mt-2 text-[13px] text-soft">
              Tú, el destino, y Wompi. El envío se calcula solo.
            </p>
            <div className="mt-8">
              <CheckoutFlow />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
