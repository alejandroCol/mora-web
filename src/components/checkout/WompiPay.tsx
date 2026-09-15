"use client";

import { useCallback, useEffect, useRef } from "react";
import type { WompiWidgetConfig } from "@/commerce/wompi";

declare global {
  interface Window {
    WidgetCheckout?: new (config: WompiWidgetConfig) => {
      open: (cb: (result: { transaction?: { id: string; status: string } }) => void) => void;
    };
  }
}

function loadWompiScript() {
  if (document.querySelector("script[data-mora-wompi]")) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.wompi.co/widget.js";
    script.async = true;
    script.dataset.moraWompi = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No cargó Wompi."));
    document.head.appendChild(script);
  });
}

export function useWompiWidget() {
  const ready = useRef(false);

  useEffect(() => {
    void loadWompiScript().then(() => {
      ready.current = true;
    });
  }, []);

  const open = useCallback(async (config: WompiWidgetConfig) => {
    await loadWompiScript();
    if (!window.WidgetCheckout) {
      throw new Error("Wompi no está disponible.");
    }
    const checkout = new window.WidgetCheckout(config);
    return new Promise<{ id: string; status: string }>((resolve, reject) => {
      checkout.open((result) => {
        if (!result.transaction?.id) {
          reject(new Error("El pago no se completó."));
          return;
        }
        resolve({
          id: result.transaction.id,
          status: result.transaction.status,
        });
      });
    });
  }, []);

  return { open };
}
