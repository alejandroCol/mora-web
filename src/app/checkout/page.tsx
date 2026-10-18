"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useMoraStore } from "@/lib/store";

export default function CheckoutPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const persist = useMoraStore.persist;
    if (persist.hasHydrated()) {
      setReady(true);
      return;
    }
    return persist.onFinishHydration(() => setReady(true));
  }, []);

  return (
    <div className="min-h-dvh bg-[#f5f5f7] pt-[calc(4.5rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-[880px] px-5 pb-20 sm:px-8">
        <Link
          href="/#coleccion"
          className="text-[13px] tracking-[-0.01em] text-[#6e6e73] hover:text-[#1d1d1f]"
        >
          ← Seguir eligiendo
        </Link>
        <div className="mt-6 sm:mt-8">
          {ready ? <CheckoutFlow /> : <div className="min-h-[24rem]" aria-hidden />}
        </div>
      </div>
    </div>
  );
}
