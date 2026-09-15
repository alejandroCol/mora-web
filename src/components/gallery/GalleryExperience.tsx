"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { GalleryImage } from "@/commerce/types";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ParticleVeil } from "@/components/gallery/ParticleVeil";
import { ZoomableImage } from "@/components/gallery/ZoomableImage";
import {
  defaultGalleryImage,
  finishes,
  formatMoney,
  products,
  type ModelId,
} from "@/lib/catalog";
import { track } from "@/growth/track";
import { useMoraStore } from "@/lib/store";

type GalleryExperienceProps = {
  modelId: ModelId;
  entrada?: boolean;
};

export function GalleryExperience({ modelId, entrada = false }: GalleryExperienceProps) {
  const router = useRouter();
  const { selection, setFinish, addSelectionToCart, closeCart } = useMoraStore();
  const model = products[modelId];
  const finish = finishes[selection.finishId];
  const [images, setImages] = useState<GalleryImage[]>([defaultGalleryImage(modelId)]);
  const [index, setIndex] = useState(0);
  const [veil, setVeil] = useState(entrada);
  const [openSheet, setOpenSheet] = useState(false);

  useEffect(() => {
    closeCart();
  }, [closeCart]);

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

  function addAndTrack() {
    addSelectionToCart(1);
    track("AddToCart", {
      content_ids: [model.id],
      content_name: `Mora ${model.name} ${finish.title}`,
      content_type: "product",
      value: model.price,
      currency: "COP",
      num_items: 1,
    });
  }

  useEffect(() => {
    if (selection.modelId !== modelId) {
      useMoraStore.getState().setModel(modelId);
    }
  }, [modelId, selection.modelId]);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/gallery?model=${modelId}`)
      .then(async (res) => {
        if (!res.ok) return { images: [] };
        return (await res.json()) as { images?: GalleryImage[] };
      })
      .then((data) => {
        if (!alive || !data.images?.length) return;
        setImages(data.images);
        setIndex(0);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [modelId]);

  useEffect(() => {
    if (!veil) return;
    const timer = window.setTimeout(() => setVeil(false), 1180);
    return () => window.clearTimeout(timer);
  }, [veil]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push("/#reservar");
      if (event.key === "ArrowRight") setIndex((value) => (value + 1) % images.length);
      if (event.key === "ArrowLeft") {
        setIndex((value) => (value - 1 + images.length) % images.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, router]);

  const current = images[index] ?? images[0];
  const usableFinishes = useMemo(
    () => model.finishes.map((id) => finishes[id]),
    [model.finishes],
  );

  function step(delta: number) {
    setIndex((value) => (value + delta + images.length) % images.length);
  }

  return (
    <div className="gallery-room relative isolate flex min-h-dvh overflow-hidden">
      {veil ? <ParticleVeil /> : null}

      <section className="relative h-dvh min-h-0 min-w-0 flex-1">
        <div className="absolute inset-0">
          {current ? (
            <ZoomableImage src={current.src} alt={`${model.name} ${index + 1}`} />
          ) : null}
        </div>

        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] lg:justify-start">
          <Link href="/" className="pointer-events-auto" aria-label="Mora">
            <BrandLogo variant="wordmark" className="h-6 w-auto object-contain sm:h-7" />
          </Link>
          <Link
            href="/#reservar"
            className="pointer-events-auto text-[13px] text-ink/55 transition-colors hover:text-ink lg:hidden"
          >
            Cerrar
          </Link>
        </header>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center text-ink/35 transition-colors hover:text-ink sm:flex"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Foto siguiente"
              className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center text-ink/35 transition-colors hover:text-ink sm:flex"
            >
              →
            </button>
            <div className="absolute inset-x-0 bottom-[5.75rem] z-20 flex justify-center px-6 lg:bottom-8">
              <div className="flex items-center gap-2 rounded-full bg-white/70 px-2 py-2 backdrop-blur-md">
                {images.map((image, itemIndex) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setIndex(itemIndex)}
                    aria-label={`Foto ${itemIndex + 1}`}
                    className={`overflow-hidden rounded-full transition-all duration-500 ${
                      itemIndex === index
                        ? "h-11 w-11 ring-1 ring-ink/30"
                        : "h-8 w-8 opacity-55 hover:opacity-90"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.src} alt={`Mora ${model.name}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </section>

      <aside className="gallery-panel-in hidden h-dvh w-[19.5rem] shrink-0 flex-col border-l border-line bg-paper lg:flex">
        <div className="flex justify-end px-6 pt-[max(1.15rem,env(safe-area-inset-top))]">
          <Link
            href="/#reservar"
            className="text-[13px] text-ink/55 transition-colors hover:text-ink"
          >
            Cerrar
          </Link>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center px-7 pb-10">
          <PanelBody
            modelId={modelId}
            finishTitle={finish.title}
            usableFinishes={usableFinishes}
            selectedFinish={selection.finishId}
            onFinish={setFinish}
            onAdd={addAndTrack}
          />
        </div>
      </aside>

      <div className="absolute inset-x-0 bottom-0 z-20 lg:hidden">
        <div className="border-t border-line bg-paper/94 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setOpenSheet((value) => !value)}
            className="flex w-full items-baseline justify-between gap-4 text-left"
          >
            <span>
              <p className="kicker">{model.line}</p>
              <p className="mt-1 text-[1.35rem] tracking-[-0.03em]">{model.name}</p>
            </span>
            <span className="text-[13px] text-ink/60">{formatMoney(model.price)}</span>
          </button>
          {openSheet ? (
            <div className="mt-5">
              <PanelBody
                modelId={modelId}
                finishTitle={finish.title}
                usableFinishes={usableFinishes}
                selectedFinish={selection.finishId}
                onFinish={setFinish}
                onAdd={addAndTrack}
                compact
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={addAndTrack}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-ink text-[13px] text-white"
            >
              Añadir {model.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelBody({
  modelId,
  finishTitle,
  usableFinishes,
  selectedFinish,
  onFinish,
  onAdd,
  compact = false,
}: {
  modelId: ModelId;
  finishTitle: string;
  usableFinishes: (typeof finishes)[keyof typeof finishes][];
  selectedFinish: string;
  onFinish: (id: (typeof finishes)[keyof typeof finishes]["id"]) => void;
  onAdd: () => void;
  compact?: boolean;
}) {
  const model = products[modelId];
  return (
    <div>
      <p className="kicker">{model.line}</p>
      <h1
        className={`title-name mt-3 text-ink ${
          compact ? "text-[2.6rem]" : "text-[3.15rem]"
        }`}
      >
        {model.name}
      </h1>
      <p className="title-whisper mt-3 text-[1.1rem] text-ink/50">{model.promise}</p>
      <ul className="mt-6 space-y-2 text-[13px] leading-6 text-ink/70">
        {model.details.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-7 text-[14px] text-ink">{formatMoney(model.price)}</p>

      <div className="mt-6">
        <p className="kicker">Acabado</p>
        <div className="mt-3 flex items-center gap-3">
          {usableFinishes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onFinish(item.id)}
              aria-label={item.title}
              aria-pressed={item.id === selectedFinish}
            >
              <span
                className={`jewel ${item.id === selectedFinish ? "jewel-on" : ""}`}
                style={{ background: item.swatch }}
              />
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[13px] text-ink">{finishTitle}</p>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-8 flex h-11 w-full items-center justify-center rounded-full bg-ink text-[13px] text-white transition-opacity hover:opacity-80"
      >
        Añadir {model.name}
      </button>
      <Link
        href="/#reservar"
        className="mt-3 flex h-10 items-center justify-center text-[13px] text-soft hover:text-ink"
      >
        Volver a elegir
      </Link>
    </div>
  );
}
