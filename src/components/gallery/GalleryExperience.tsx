"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GalleryImage } from "@/commerce/types";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ParticleVeil } from "@/components/gallery/ParticleVeil";
import { ZoomableImage } from "@/components/gallery/ZoomableImage";
import { BuySheet } from "@/components/product/BuySheet";
import {
  defaultGalleryImages,
  finishLabel,
  products,
  productPath,
  type ModelId,
} from "@/lib/catalog";
import { track } from "@/growth/track";
import { useInsightImage, useInsightProduct } from "@/insights/client";
import { useMoraStore } from "@/lib/store";

export function GalleryExperience({
  modelId,
  entrada = false,
}: {
  modelId: ModelId;
  entrada?: boolean;
}) {
  const router = useRouter();
  const { selection, closeCart } = useMoraStore();
  const model = products[modelId];
  const finishId = model.finishes.includes(selection.finishId)
    ? selection.finishId
    : model.finishes[0];
  const [remote, setRemote] = useState<GalleryImage[]>([]);
  const [index, setIndex] = useState(0);
  const [veil, setVeil] = useState(entrada);

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
        if (!alive) return;
        setRemote(data.images ?? []);
        setIndex(0);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [modelId]);

  const uploaded = remote.filter(
    (item) => !item.system && (!item.finishId || item.finishId === finishId),
  );
  const house = defaultGalleryImages(modelId, finishId);
  const houseHidden = remote.some(
    (item) => item.hidden && house.some((entry) => entry.id === item.id),
  );
  const images = [...uploaded, ...(houseHidden ? [] : house)];

  useEffect(() => {
    setIndex(0);
  }, [modelId, finishId]);

  useEffect(() => {
    if (!veil) return;
    const timer = window.setTimeout(() => setVeil(false), 1180);
    return () => window.clearTimeout(timer);
  }, [veil]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push(productPath(modelId));
      if (event.key === "ArrowRight") setIndex((value) => (value + 1) % images.length);
      if (event.key === "ArrowLeft") {
        setIndex((value) => (value - 1 + images.length) % images.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, modelId, router]);

  const current = images[index] ?? images[0];
  useInsightProduct(model.id, model.name);
  useInsightImage({
    productId: model.id,
    productName: model.name,
    imageId: current?.id ?? "",
    imageSrc: current?.src,
    finishId: current?.finishId ?? finishId,
    kind: "photo",
    label: current
      ? `${model.name} · ${current.finishId ? finishLabel(modelId, current.finishId) : `foto ${index + 1}`}`
      : model.name,
  });

  function step(delta: number) {
    setIndex((value) => (value + delta + images.length) % images.length);
  }

  return (
    <div className="gallery-room relative isolate flex h-dvh overflow-hidden">
      {veil ? <ParticleVeil /> : null}

      <section className="relative min-h-0 min-w-0 flex-1">
        <div className="absolute inset-0">
          {current ? (
            <ZoomableImage
              src={current.src}
              alt={`${model.name} ${index + 1}`}
              onSwipePrev={() => step(-1)}
              onSwipeNext={() => step(1)}
            />
          ) : null}
        </div>

        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <Link href="/" className="pointer-events-auto" aria-label="Mora">
            <BrandLogo variant="wordmark" className="h-6 w-auto object-contain sm:h-7" />
          </Link>
          <Link
            href={productPath(modelId)}
            className="pointer-events-auto text-[13px] tracking-[-0.01em] text-ink/55 hover:text-ink lg:hidden"
          >
            Anillo
          </Link>
        </header>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center text-ink/35 hover:text-ink sm:flex"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Foto siguiente"
              className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center text-ink/35 hover:text-ink lg:right-[calc(24.5rem+0.75rem)] sm:flex"
            >
              ›
            </button>
            <div className="absolute inset-x-0 top-[calc(3.4rem+env(safe-area-inset-top))] z-20 flex justify-center px-6 lg:top-auto lg:bottom-6 lg:left-0 lg:right-[24.5rem]">
              <div className="flex items-center gap-2 rounded-full bg-white/70 px-2 py-2 backdrop-blur-md">
                {images.map((image, itemIndex) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setIndex(itemIndex)}
                    aria-label={`Foto ${itemIndex + 1}`}
                    className={`overflow-hidden rounded-full transition-all duration-500 ${
                      itemIndex === index
                        ? "h-10 w-10 ring-1 ring-ink/30"
                        : "h-7 w-7 opacity-55 hover:opacity-90"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.src}
                      alt={`Mora ${model.name}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </section>

      <aside className="absolute inset-x-0 bottom-0 z-30 flex h-[58%] flex-col overflow-hidden rounded-t-[28px] bg-[#f5f5f7]/96 shadow-[0_-18px_50px_rgba(22,20,31,0.12)] backdrop-blur-xl lg:static lg:h-dvh lg:w-[24.5rem] lg:rounded-none lg:bg-[#f5f5f7] lg:shadow-none lg:backdrop-blur-none">
        <div className="hidden justify-end px-7 pt-[max(1.15rem,env(safe-area-inset-top))] lg:flex">
          <Link
            href={productPath(modelId)}
            className="text-[13px] tracking-[-0.01em] text-ink/45 hover:text-ink"
          >
            Ver anillo
          </Link>
        </div>
        <div className="min-h-0 flex-1 lg:pb-0">
          <BuySheet modelId={modelId} description="" />
        </div>
      </aside>
    </div>
  );
}
