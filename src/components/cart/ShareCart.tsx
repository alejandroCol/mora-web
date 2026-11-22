"use client";

import { useState } from "react";
import type { CartLine } from "@/commerce/types";

function fingerprint(cart: CartLine[]) {
  return cart.map((line) => `${line.key}:${line.qty}`).join("|");
}

/**
 * Abre la hoja de compartir. El enlace se crea al tocar y queda congelado:
 * el mismo pedido reutiliza el enlace, uno distinto pide otro.
 */
export function ShareCart({ cart }: { cart: CartLine[] }) {
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState<{ url: string; of: string } | null>(null);
  const [native, setNative] = useState(false);

  const current = link?.of === fingerprint(cart) ? link.url : "";

  async function open() {
    setError("");
    setCopied(false);
    setNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
    if (current) {
      setSheet(true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/cart/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) throw new Error(data.error || "No se pudo crear el enlace.");
      setLink({ url: data.url, of: fingerprint(cart) });
      setSheet(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el enlace.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!current) return;
    try {
      await navigator.share({
        title: "Un pedido de Mora",
        text: "Mira este pedido. Puedes terminarlo cuando quieras.",
        url: current,
      });
    } catch (err) {
      // Cancelar el panel del sistema no es un error.
      if (err instanceof Error && err.name === "AbortError") return;
      setError("No se pudo abrir el menú para enviar. Copia el enlace.");
    }
  }

  async function copy() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar. Mantén presionado el enlace.");
    }
  }

  const whatsapp = current
    ? `https://wa.me/?text=${encodeURIComponent(`Mira este pedido de Mora. Puedes terminarlo cuando quieras: ${current}`)}`
    : "";

  return (
    <>
      <button type="button" onClick={() => void open()} disabled={busy} className="cart-share">
        {busy ? "Preparando el enlace…" : "Compartir mi carrito"}
      </button>
      {error && !sheet ? <p className="mt-2 text-center text-[12px] text-[#9a3b3b]">{error}</p> : null}

      {sheet && current ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setSheet(false)}
            className="absolute inset-0 bg-[#16141f]/25"
          />
          <div className="relative rounded-t-[28px] bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-24px_60px_rgba(22,20,31,0.18)]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e6e2f4]" />
            <p className="text-[13px] font-medium text-[#6f61b8]">Listo para enviar</p>
            <h3 className="mt-1 text-[22px] leading-tight tracking-[-0.03em] text-ink">
              Comparte este pedido
            </h3>
            <p className="mt-1.5 text-[14px] leading-6 text-soft">
              Quien lo abra ve estos anillos y puede comprarlos. El precio es el de ese día.
            </p>
            <p className="mt-3 truncate rounded-2xl bg-[#f6f5f8] px-4 py-3 text-[13px] text-ink">{current}</p>
            {native ? (
              <button type="button" onClick={() => void send()} className="elegir-cta mt-4 w-full">
                Enviar
                <span aria-hidden className="elegir-cta-arrow">
                  ›
                </span>
              </button>
            ) : (
              <button type="button" onClick={() => void copy()} className="elegir-cta mt-4 w-full">
                {copied ? "Copiado" : "Copiar enlace"}
              </button>
            )}
            <div className={`mt-2.5 grid gap-2 ${native ? "grid-cols-2" : "grid-cols-1"}`}>
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center justify-center rounded-full bg-[#f4f3f8] text-[14px] font-medium text-ink"
              >
                WhatsApp
              </a>
              {native ? (
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="flex h-12 items-center justify-center rounded-full bg-[#f4f3f8] text-[14px] font-medium text-ink"
                >
                  {copied ? "Copiado" : "Copiar enlace"}
                </button>
              ) : null}
            </div>
            {error ? <p className="mt-3 text-center text-[12px] text-[#9a3b3b]">{error}</p> : null}
            <p className="mt-3 text-center text-[12px] text-soft">El enlace funciona 90 días.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
