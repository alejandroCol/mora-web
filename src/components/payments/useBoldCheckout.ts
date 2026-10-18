"use client";

import { useCallback } from "react";
import { BOLD_CHECKOUT_SRC, type BoldCheckoutConfig, type BoldCheckoutSession } from "@/payments/types";

declare global {
  interface Window {
    BoldCheckout?: new (config: BoldCheckoutConfig) => {
      open: () => void;
      getConfig?: (key: string) => string;
      updateConfig?: (key: string, value: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadBoldScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("El pago solo corre en el navegador."));
  }
  if (window.BoldCheckout) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const ok = () => {
      if (window.BoldCheckout) resolve();
      else {
        scriptPromise = null;
        reject(new Error("No cargó el pago."));
      }
    };
    const fail = () => {
      scriptPromise = null;
      reject(new Error("No cargó el pago."));
    };

    const existing = document.querySelector<HTMLScriptElement>("script[data-mora-bold]");
    if (existing) {
      existing.addEventListener("load", ok, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = BOLD_CHECKOUT_SRC;
    script.async = true;
    script.dataset.moraBold = "true";
    script.onload = () => {
      window.dispatchEvent(new Event("boldCheckoutLoaded"));
      ok();
    };
    script.onerror = () => {
      window.dispatchEvent(new Event("boldCheckoutLoadFailed"));
      fail();
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function checkoutForBold(session: BoldCheckoutSession): BoldCheckoutConfig {
  const source = session.checkout;
  const checkout: BoldCheckoutConfig = {
    orderId: String(source.orderId),
    currency: source.currency,
    amount: String(source.amount),
    apiKey: String(source.apiKey),
    integritySignature: String(source.integritySignature),
    renderMode: "embedded",
  };
  if (source.description) checkout.description = source.description;
  if (source.redirectionUrl?.startsWith("https://")) {
    checkout.redirectionUrl = source.redirectionUrl;
  }
  return checkout;
}

export async function payWithBold(session: BoldCheckoutSession) {
  await loadBoldScript();
  if (!window.BoldCheckout) {
    throw new Error("El pago no está disponible.");
  }
  const checkout = new window.BoldCheckout(checkoutForBold(session));
  checkout.open();
}

export function useBoldCheckout() {
  const pay = useCallback((session: BoldCheckoutSession) => payWithBold(session), []);
  return { pay };
}
