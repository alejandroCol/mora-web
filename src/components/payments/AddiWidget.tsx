"use client";

import { createElement, useEffect } from "react";
import { ADDI_WIDGET_SRC, addiAllySlug, addiAmountAllowed } from "@/payments/public";

let scriptPromise: Promise<void> | null = null;

function loadAddiWidget() {
  if (typeof window === "undefined") return Promise.resolve();
  if (document.querySelector("script[data-mora-addi]")) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = ADDI_WIDGET_SRC;
    script.async = true;
    script.dataset.moraAddi = "true";
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("No cargó Addi."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function AddiWidget({
  price,
  className,
}: {
  price: number;
  className?: string;
}) {
  const slug = addiAllySlug();
  const amount = Math.round(price);
  const show = Boolean(slug) && addiAmountAllowed(amount);

  useEffect(() => {
    if (!show) return;
    void loadAddiWidget().catch(() => undefined);
  }, [show]);

  if (!show) return null;

  return (
    <div className={`addi-slot ${className ?? ""}`}>
      {createElement("addi-widget", {
        price: String(amount),
        "ally-slug": slug,
      })}
    </div>
  );
}
