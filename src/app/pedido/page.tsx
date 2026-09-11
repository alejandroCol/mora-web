"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { finishes, formatMoney, products } from "@/lib/catalog";
import { useMoraStore } from "@/lib/store";

function Confirmation() {
  const params = useSearchParams();
  const lastOrder = useMoraStore((state) => state.lastOrder);
  const ref = params.get("ref") ?? lastOrder?.id;
  const order = lastOrder?.id === ref ? lastOrder : lastOrder;
  const model =
    order && products[order.modelId] ? products[order.modelId] : products.aero;
  const finish =
    order && finishes[order.finishId] ? finishes[order.finishId] : finishes.white;

  return (
    <div className="hero-wash grid min-h-dvh place-items-center px-6 pt-16 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-lg text-center">
        <p className="kicker">{ref ?? "Mora"}</p>
        <h1 className="title-film mt-5 text-[clamp(2.6rem,14vw,5.5rem)] text-ink sm:mt-6">
          Reservado.
        </h1>
        <p className="mt-6 text-sm leading-7 text-soft">
          {order
            ? `Mora ${model.name} en ${finish.title}, talla ${order.size}. Te escribimos a ${order.email}.`
            : "Tu reserva quedó en el atelier. Si recargas esta página, vuelve a la landing."}
        </p>
        {order ? (
          <p className="mt-4 text-sm text-ink">{formatMoney(order.total)}</p>
        ) : null}
        <Link
          href="/"
          className="mt-12 inline-flex h-12 items-center rounded-full bg-ink px-8 text-[14px] text-white"
        >
          Volver
        </Link>
      </div>
    </div>
  );
}

export default function PedidoPage() {
  return (
    <Suspense>
      <Confirmation />
    </Suspense>
  );
}
