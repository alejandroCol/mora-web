"use client";

import Link from "next/link";
import { catalog, finishes, formatMoney, products } from "@/lib/catalog";
import { useMoraStore } from "@/lib/store";

export function Configurator() {
  const { selection, setModel, setFinish, setSize } = useMoraStore();
  const model = products[selection.modelId];
  const finish = finishes[selection.finishId];

  return (
    <div className="max-w-md space-y-5">
      <header>
        <p className="kicker">{model.line}</p>
        <div className="mt-1.5 flex items-baseline justify-between gap-6">
          <h2 className="text-[1.65rem] font-medium tracking-[-0.03em] text-ink">
            {model.name}
          </h2>
          <p className="text-[14px] text-ink/80">{formatMoney(model.price)}</p>
        </div>
        <p className="mt-1 text-[13px] leading-5 text-soft">{model.promise}</p>
      </header>

      <fieldset>
        <legend className="kicker">Modelo</legend>
        <div className="mt-2.5 flex gap-1 rounded-full bg-white/70 p-1">
          {catalog.map((item) => {
            const active = item.id === selection.modelId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setModel(item.id)}
                className={`flex-1 rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                  active ? "bg-ink text-white" : "text-soft hover:text-ink"
                }`}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="kicker">Acabado</legend>
        <div className="mt-3 flex items-center gap-5">
          {model.finishes.map((id) => {
            const item = finishes[id];
            const active = id === selection.finishId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFinish(id)}
                className="group flex items-center gap-2.5"
                aria-pressed={active}
                aria-label={item.title}
              >
                <span
                  className={`jewel ${active ? "jewel-on" : ""}`}
                  style={{ background: item.swatch }}
                />
                <span
                  className={`text-left text-[13px] leading-4 ${
                    active ? "text-ink" : "text-soft/70"
                  }`}
                >
                  {item.title}
                </span>
              </button>
            );
          })}
        </div>
        <p className="title-whisper mt-2 text-[15px] text-ink/55">
          {finish.whisper}
        </p>
      </fieldset>

      <fieldset>
        <legend className="kicker">Talla</legend>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {model.sizes.map((size) => {
            const active = size === selection.size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => setSize(size)}
                className={`min-w-9 rounded-full px-2.5 py-1 text-[13px] transition-colors ${
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

      <Link
        href="/checkout"
        className="inline-flex h-10 items-center rounded-full bg-ink px-6 text-[13px] text-white transition-opacity hover:opacity-80"
      >
        Reservar {model.name}
      </Link>
    </div>
  );
}
