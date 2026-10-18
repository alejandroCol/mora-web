"use client";

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
    <div className="check-page min-h-dvh bg-[#f5f5f7] pt-[calc(3.5rem+env(safe-area-inset-top))] sm:pt-[calc(4.25rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-[880px] px-3 pb-0 sm:px-8 sm:pb-16">
        {ready ? <CheckoutFlow /> : <div className="min-h-[24rem]" aria-hidden />}
      </div>
    </div>
  );
}
