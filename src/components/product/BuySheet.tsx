"use client";

import {
  finishLabel,
  finishes,
  formatMoney,
  products,
  type ModelId,
} from "@/lib/catalog";
import { PRESALE } from "@/lib/presale";
import { track } from "@/growth/track";
import { useMoraStore } from "@/lib/store";
import { SizeChoice } from "./SizeChoice";

export function BuySheet({
  modelId,
  onGallery,
}: {
  modelId: ModelId;
  onGallery?: () => void;
}) {
  const { selection, setFinish, setSize, setSizing, addSelectionToCart } =
    useMoraStore();
  const model = products[modelId];
  const finishId = model.finishes.includes(selection.finishId)
    ? selection.finishId
    : model.finishes[0];
  const finish = finishes[finishId];
  const sizing = selection.sizing;
  const canAdd =
    sizing === "kit" ||
    (sizing === "self" && model.sizes.includes(selection.size));

  function add() {
    if (!canAdd) return;
    addSelectionToCart(1);
    track("AddToCart", {
      content_ids: [model.id],
      content_name: `Mora ${model.name} ${finishLabel(modelId, finishId)}`,
      content_type: "product",
      value: model.price,
      currency: "COP",
      num_items: 1,
    });
  }

  const hint =
    sizing === "kit"
      ? "Reservar con medidor. Confirmas la talla después."
      : sizing === "self"
        ? `Se entrega el ${PRESALE.deliveryLabel}.`
        : "Elige si quieres medidor para reservar.";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 hide-scroll sm:px-8 sm:pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="title-name text-[2.35rem] text-[#1d1d1f] sm:text-[2.85rem]">
            {model.name}
          </h1>
          <p className="text-[17px] tracking-[-0.02em] text-[#1d1d1f]">
            {formatMoney(model.price)}
          </p>
        </div>
        <p className="mt-1.5 text-[15px] leading-6 text-soft">{model.promise}</p>
        <p className="mt-2 text-[12px] text-soft">
          {model.line} · {model.weight} · {model.battery}
        </p>

        <fieldset className="mt-7">
          <legend className="text-[12px] text-soft">Color</legend>
          <div className="mt-3 flex gap-2">
            {model.finishes.map((id) => {
              const item = finishes[id];
              const on = id === finishId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFinish(id)}
                  aria-pressed={on}
                  aria-label={finishLabel(modelId, id)}
                  className="finish-pick"
                >
                  <span
                    className={`finish-swatch ${on ? "finish-swatch-on" : ""}`}
                    style={{ background: item.swatch }}
                  />
                  <span className="finish-label">
                    {finishLabel(modelId, id)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-[12px] leading-5 text-soft">{finish.whisper}</p>
        </fieldset>

        {model.kind === "ring" ? (
          <div className="mt-6">
            <SizeChoice
              sizing={sizing}
              onSizing={setSizing}
              sizes={model.sizes}
              size={selection.size}
              onSize={setSize}
            />
          </div>
        ) : null}

        {onGallery ? (
          <button
            type="button"
            onClick={onGallery}
            className="mt-5 hidden text-[13px] tracking-[-0.01em] text-soft hover:text-ink lg:inline"
          >
            Ver imágenes ›
          </button>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-line bg-white/80 px-5 py-3 backdrop-blur-xl pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        <button
          type="button"
          disabled={!canAdd}
          onClick={add}
          className="flex h-11 w-full items-center justify-center rounded-full bg-[#1d1d1f] text-[17px] tracking-[-0.022em] text-white transition-colors hover:bg-[#3a3a3c] disabled:opacity-35"
        >
          Reservar {model.name}
        </button>
        <p className="mt-2 text-center text-[11px] leading-4 text-soft">{hint}</p>
      </div>
    </div>
  );
}
