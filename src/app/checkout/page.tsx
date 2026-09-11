"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { finishes, formatMoney, products } from "@/lib/catalog";
import { useMoraStore } from "@/lib/store";

const RingCanvas = dynamic(
  () => import("@/components/ring/RingCanvas").then((mod) => mod.RingCanvas),
  { ssr: false },
);

export default function CheckoutPage() {
  const selection = useMoraStore((state) => state.selection);
  const model = products[selection.modelId];
  const finish = finishes[selection.finishId];

  return (
    <div className="hero-wash min-h-dvh pt-[calc(4.5rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-xl px-6 pb-16 lg:max-w-6xl">
        <Link
          href="/#reservar"
          className="text-[13px] text-soft hover:text-ink"
        >
          ← Anillo
        </Link>

        <div className="mt-6 grid items-start gap-8 lg:mt-8 lg:grid-cols-[0.7fr_1.1fr] lg:gap-16">
          <div className="hidden lg:block lg:h-[26rem]">
            <RingCanvas
              configure
              finishId={selection.finishId}
              className="h-full w-full"
            />
          </div>

          <div className="mx-auto w-full max-w-[22rem] lg:mx-0 lg:max-w-none">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="kicker">Reserva</p>
                <h1 className="mt-2 text-[1.85rem] font-medium tracking-[-0.04em] text-ink sm:text-[2.1rem]">
                  {model.name}
                </h1>
                <p className="mt-1 text-[13px] text-soft">
                  {finish.title} · #{selection.size}
                </p>
              </div>
              <p className="text-[14px] text-ink">
                {formatMoney(model.price)}
              </p>
            </div>
            <div className="mt-8">
              <CheckoutForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
