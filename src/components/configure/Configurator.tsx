"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ParticleVeil } from "@/components/gallery/ParticleVeil";
import { catalog, finishes, formatMoney, products } from "@/lib/catalog";
import { track } from "@/growth/track";
import { useMoraStore } from "@/lib/store";

export function Configurator() {
  const router = useRouter();
  const { selection, setModel, setFinish, setSize, addSelectionToCart, closeCart } =
    useMoraStore();
  const model = products[selection.modelId];
  const finish = finishes[selection.finishId];
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    track("ViewContent", {
      content_ids: [model.id],
      content_name: `Mora ${model.name}`,
      content_type: "product",
      content_category: model.line,
      value: model.price,
      currency: "COP",
    });
  }, [model.id, model.line, model.name, model.price]);

  function openGallery() {
    closeCart();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      router.push(`/galeria/${selection.modelId}?entrada=1`);
      return;
    }
    setLeaving(true);
    window.setTimeout(() => {
      router.push(`/galeria/${selection.modelId}?entrada=1`);
    }, 720);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <p className="kicker">{model.line}</p>
          <h2 className="mt-1 text-[1.45rem] font-medium tracking-[-0.03em] text-ink sm:text-[1.65rem]">
            {model.name}
          </h2>
        </div>
        <p className="text-[13px] text-ink/70 sm:text-[14px]">
          {formatMoney(model.price)}
        </p>
      </header>
      <button
        type="button"
        onClick={openGallery}
        className="mt-3 text-[13px] text-soft transition-colors hover:text-ink"
      >
        Ver imágenes
      </button>

      <fieldset className="mt-5">
        <legend className="kicker">Modelo</legend>
        <div className="mt-2 flex gap-1 rounded-full bg-white/70 p-1">
          {catalog.map((item) => {
            const active = item.id === selection.modelId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setModel(item.id)}
                className={`flex-1 rounded-full px-3 py-2 text-[13px] transition-colors ${
                  active ? "bg-ink text-white" : "text-soft hover:text-ink"
                }`}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="kicker">Acabado</legend>
        <div className="mt-3 flex items-center gap-4">
          {model.finishes.map((id) => {
            const item = finishes[id];
            const active = id === selection.finishId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFinish(id)}
                className="flex items-center"
                aria-pressed={active}
                aria-label={item.title}
              >
                <span
                  className={`jewel ${active ? "jewel-on" : ""}`}
                  style={{ background: item.swatch }}
                />
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[13px] text-ink">{finish.title}</p>
        <p className="title-whisper mt-0.5 text-[14px] text-ink/45">
          {finish.whisper}
        </p>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="kicker">Talla</legend>
        <div className="mt-2 flex flex-wrap gap-1">
          {model.sizes.map((size) => {
            const active = size === selection.size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => setSize(size)}
                className={`min-h-9 min-w-9 rounded-full px-2.5 text-[13px] transition-colors ${
                  active
                    ? "bg-ink text-white"
                    : "text-soft hover:bg-white/80 hover:text-ink"
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="sticky bottom-0 z-20 -mx-6 mt-6 border-t border-line bg-[#f4f3f8]/92 px-6 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mt-7 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => {
              addSelectionToCart(1);
              track("AddToCart", {
                content_ids: [model.id],
                content_name: `Mora ${model.name} ${finish.title}`,
                content_type: "product",
                value: model.price,
                currency: "COP",
                num_items: 1,
              });
            }}
            className="flex h-11 w-full items-center justify-center rounded-full bg-ink text-[13px] text-white transition-opacity hover:opacity-80 sm:w-auto sm:px-7"
          >
            Añadir {model.name}
          </button>
          <Link
            href="/checkout"
            className="flex h-11 w-full items-center justify-center rounded-full px-4 text-[13px] text-ink sm:w-auto"
          >
            Ir a pagar
          </Link>
        </div>
      </div>
      {leaving ? <ParticleVeil /> : null}
    </div>
  );
}
