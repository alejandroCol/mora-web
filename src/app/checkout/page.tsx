"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { useMoraStore } from "@/lib/store";

const RingCanvas = dynamic(
  () => import("@/components/ring/RingCanvas").then((mod) => mod.RingCanvas),
  { ssr: false },
);

export default function CheckoutPage() {
  const finishId = useMoraStore((state) => state.selection.finishId);

  return (
    <div className="hero-wash min-h-dvh pt-24">
      <div className="mx-auto max-w-6xl px-6 pb-24">
        <Link
          href="/#reservar"
          className="text-[13px] text-soft hover:text-ink"
        >
          Volver al anillo
        </Link>
        <div className="mt-8 grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="hidden h-[28rem] lg:block">
            <RingCanvas
              configure
              finishId={finishId}
              className="h-full w-full"
            />
          </div>
          <div>
            <p className="kicker">Reserva</p>
            <h1 className="display mt-4 text-[2.75rem] leading-none text-ink">
              Tu anillo.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-7 text-soft">
              Confirmamos a mano. Sin carrito. Sin prisa.
            </p>
            <div className="mt-12">
              <CheckoutForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
