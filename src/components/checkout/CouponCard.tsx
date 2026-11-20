"use client";

import Link from "next/link";
import { useState } from "react";

export function CouponCard({ code, session }: { code: string; session: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!code) {
    return (
      <div className="mx-auto max-w-[420px] rounded-[24px] border border-[#ebe8f5] bg-white p-8 text-center">
        <p className="text-[15px] text-[#6a6580]">No encontramos ese código.</p>
        <Link href="/" className="mt-5 inline-block text-[15px] font-medium text-[#6f61b8]">
          Ir a la tienda
        </Link>
      </div>
    );
  }

  const params = new URLSearchParams({ oferta: code });
  if (session) params.set("carrito", session);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="mx-auto max-w-[420px] rounded-[24px] border border-[#ebe8f5] bg-white p-7 text-center sm:p-9">
      <p className="text-[14px] font-medium text-[#6f61b8]">Tu código de descuento</p>
      <p className="mt-4 select-all rounded-[16px] border border-dashed border-[#cfc8ea] bg-[#fbfbfd] px-4 py-5 text-[26px] font-medium tracking-[0.14em] text-[#16141f]">
        {code}
      </p>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-4 w-full rounded-full border border-[#e6e2f4] bg-[#f4f3f8] px-6 py-3.5 text-[15px] font-medium text-[#16141f] transition active:scale-[0.99]"
      >
        {copied ? "Copiado" : "Copiar código"}
      </button>
      {failed ? (
        <p className="mt-2 text-[13px] text-[#6a6580]">No se pudo copiar. Mantén presionado el código y cópialo.</p>
      ) : null}
      <Link
        href={`/checkout?${params.toString()}`}
        className="mt-3 block w-full rounded-full bg-[#6f61b8] px-6 py-3.5 text-[15px] font-medium text-white transition active:scale-[0.99]"
      >
        Usar mi descuento
      </Link>
      <p className="mt-5 text-[13px] leading-relaxed text-[#8b84a6]">
        Con el botón ya va aplicado. Si prefieres, pégalo en «¿Tienes un código de descuento?» al pagar.
      </p>
    </div>
  );
}
