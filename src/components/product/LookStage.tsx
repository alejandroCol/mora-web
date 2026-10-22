"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/commerce/types";
import {
  defaultGalleryImages,
  finishLabel,
  finishes,
  products,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { useMoraStore } from "@/lib/store";

const RingCanvas = dynamic(
  () => import("@/components/ring/RingCanvas").then((mod) => mod.RingCanvas),
  { ssr: false },
);

type LookImage = { id: string; src: string; alt: string };
type StageItem =
  | { id: "ring"; kind: "ring" }
  | { id: string; kind: "photo"; src: string; alt: string };

function matchesFinish(image: GalleryImage, finishId: FinishId) {
  return !image.finishId || image.finishId === finishId;
}

function asLooks(modelId: ModelId, finishId: FinishId, remote: GalleryImage[]): LookImage[] {
  const name = `Mora ${products[modelId].name} ${finishLabel(modelId, finishId)}`;
  const uploaded = remote.filter(
    (item) => !item.system && matchesFinish(item, finishId) && !item.hidden,
  );
  const house = defaultGalleryImages(modelId, finishId);
  const houseHidden = remote.some(
    (item) => item.hidden && house.some((entry) => entry.id === item.id),
  );
  return [...uploaded, ...(houseHidden ? [] : house)].map((item) => ({
    id: item.id,
    src: item.src,
    alt: name,
  }));
}

export function LookStage({ modelId }: { modelId: ModelId }) {
  const { selection } = useMoraStore();
  const model = products[modelId];
  const finishId = model.finishes.includes(selection.finishId)
    ? selection.finishId
    : model.finishes[0];
  const [remote, setRemote] = useState<GalleryImage[]>([]);
  const [index, setIndex] = useState(0);
  const [seenFinish, setSeenFinish] = useState(finishId);
  const [prev, setPrev] = useState<number | null>(null);
  if (seenFinish !== finishId) {
    setSeenFinish(finishId);
    setIndex(0);
    setPrev(null);
  }
  const [desktop, setDesktop] = useState(false);
  const swipe = useRef<number | null>(null);
  const images = asLooks(modelId, finishId, remote);

  const items: StageItem[] = [
    { id: "ring", kind: "ring" },
    ...images.map((image) => ({ ...image, kind: "photo" as const })),
  ];

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/gallery?model=${modelId}`)
      .then(async (res) => (await res.json()) as { images?: GalleryImage[] })
      .then((data) => {
        if (!alive) return;
        setRemote(data.images ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [modelId]);

  const current = items[index] ?? items[0];
  const leaving = prev != null ? items[prev] : null;

  function go(next: number) {
    if (!items.length) return;
    const wrapped = (next + items.length) % items.length;
    if (wrapped === index) return;
    setPrev(null);
    setIndex(wrapped);
  }

  useEffect(() => {
    const ahead = images[index] ?? images[0];
    if (!ahead) return;
    const node = new Image();
    node.src = ahead.src;
  }, [index, images]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) return null;

  const leavingPhoto = leaving?.kind === "photo" ? leaving : null;
  const currentPhoto = current.kind === "photo" ? current : null;

  return (
    <div className="look-stage">
      <div className="look-atmosphere" aria-hidden>
        {leavingPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`bloom-leave-${leavingPhoto.id}`}
            className="look-bloom look-bloom-leave"
            src={leavingPhoto.src}
            alt=""
          />
        ) : null}
        {currentPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`bloom-${currentPhoto.id}`}
            className="look-bloom look-bloom-in"
            src={currentPhoto.src}
            alt=""
          />
        ) : null}
        <div className="look-veil" />
      </div>

      <div
        className="look-frame"
        onPointerDown={(event) => {
          swipe.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (swipe.current == null) return;
          const dx = event.clientX - swipe.current;
          swipe.current = null;
          if (dx > 56) go(index - 1);
          else if (dx < -56) go(index + 1);
        }}
      >
        {items.length > 1 ? (
          <>
            <button
              type="button"
              className="look-hit look-hit-prev"
              aria-label="Foto anterior"
              onClick={() => go(index - 1)}
            />
            <button
              type="button"
              className="look-hit look-hit-next"
              aria-label="Foto siguiente"
              onClick={() => go(index + 1)}
            />
          </>
        ) : null}

        {leavingPhoto ? (
          <LookSlide
            key={`leave-${leavingPhoto.id}`}
            src={leavingPhoto.src}
            alt=""
            className="look-fade-out"
            hidden
          />
        ) : null}

        {current.kind === "ring" ? (
          <div className={`look-ring ${prev != null ? "look-fade-in" : ""}`}>
            <RingCanvas
              configure
              floatOnly
              finishId={finishId}
              scale={desktop ? 0.62 : 0.66}
              className="h-full w-full max-w-[34rem]"
            />
          </div>
        ) : (
          <LookSlide
            key={current.id}
            src={current.src}
            alt={current.alt}
            className={prev != null ? "look-fade-in" : ""}
          />
        )}
      </div>

      {items.length > 1 ? (
        <nav className="look-rail" aria-label="Fotos del anillo">
          {items.map((item, itemIndex) => {
            const on = itemIndex === index;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={
                  item.kind === "ring"
                    ? `Mora ${model.name} en 3D`
                    : `${item.alt}, foto ${itemIndex}`
                }
                aria-current={on || undefined}
                className={`look-thumb ${on ? "on" : ""}`}
                onClick={() => go(itemIndex)}
              >
                {item.kind === "ring" ? (
                  <span
                    className="look-thumb-ring"
                    style={{ background: finishes[finishId].swatch }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.src} alt="" />
                )}
              </button>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

function LookSlide({
  src,
  alt,
  className,
  hidden,
}: {
  src: string;
  alt: string;
  className: string;
  hidden?: boolean;
}) {
  return (
    <figure
      className={`look-slide ${className}`}
      aria-hidden={hidden || undefined}
    >
      <div className="look-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="look-photo" src={src} alt={alt} decoding="async" />
      </div>
    </figure>
  );
}
