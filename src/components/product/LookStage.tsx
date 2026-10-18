"use client";

import { useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/commerce/types";
import { products, type ModelId } from "@/lib/catalog";

type LookImage = { id: string; src: string; alt: string };

function fallbackLooks(modelId: ModelId): LookImage[] {
  const name = `Mora ${products[modelId].name}`;
  if (modelId === "aero") {
    return [
      { id: "pro-life", src: "/lifestyle/pro.jpg", alt: name },
      { id: "pro-ring", src: "/gallery/rings.png", alt: name },
      { id: "pro-lilac", src: "/encuesta/lila.jpg", alt: `${name} Lila` },
      { id: "pro-white", src: "/encuesta/blanco.jpg", alt: `${name} Blanco` },
      { id: "pro-black", src: "/encuesta/mate.jpg", alt: `${name} Negro` },
    ];
  }
  return [
    { id: "ultra-life", src: "/lifestyle/ultra.jpg", alt: name },
    { id: "ultra-ring", src: "/gallery/rings.png", alt: name },
    { id: "ultra-silver", src: "/encuesta/plata.jpg", alt: `${name} Plata` },
    { id: "ultra-gold", src: "/encuesta/oro.jpg", alt: `${name} Oro` },
    { id: "ultra-black", src: "/encuesta/mate.jpg", alt: `${name} Negro mate` },
  ];
}

function mergeLooks(modelId: ModelId, remote: GalleryImage[]): LookImage[] {
  const name = `Mora ${products[modelId].name}`;
  const uploaded = remote
    .filter((item) => !item.system)
    .map((item) => ({ id: item.id, src: item.src, alt: name }));
  const seen = new Set<string>();
  const next: LookImage[] = [];
  for (const item of [...uploaded, ...fallbackLooks(modelId)]) {
    if (seen.has(item.src)) continue;
    seen.add(item.src);
    next.push(item);
  }
  return next;
}

export function LookStage({
  modelId,
  onBack,
}: {
  modelId: ModelId;
  onBack: () => void;
}) {
  const [images, setImages] = useState<LookImage[]>(() => fallbackLooks(modelId));
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const swipe = useRef<number | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/gallery?model=${modelId}`)
      .then(async (res) => (await res.json()) as { images?: GalleryImage[] })
      .then((data) => {
        if (!alive) return;
        setImages(mergeLooks(modelId, data.images ?? []));
        setIndex(0);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [modelId]);

  const current = images[index];
  const leaving = prev != null ? images[prev] : null;

  function go(next: number) {
    if (!images.length || lock.current) return;
    const wrapped = (next + images.length) % images.length;
    if (wrapped === index) return;
    const last = images.length - 1;
    const forward =
      wrapped === (index + 1) % images.length ||
      (index !== last && wrapped > index && !(index === 0 && wrapped === last));
    lock.current = true;
    setDir(forward ? 1 : -1);
    setPrev(index);
    setIndex(wrapped);
    window.setTimeout(() => {
      setPrev(null);
      lock.current = false;
    }, 720);
  }

  useEffect(() => {
    const ahead = images[(index + 1) % images.length];
    if (!ahead) return;
    const node = new Image();
    node.src = ahead.src;
  }, [index, images]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) return null;

  return (
    <div className="look-stage">
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
        {leaving ? (
          <figure
            key={`leave-${leaving.id}`}
            className={`look-slide look-leave-${dir > 0 ? "next" : "prev"}`}
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={leaving.src} alt="" />
          </figure>
        ) : null}
        <figure
          key={current.id}
          className={`look-slide look-enter-${dir > 0 ? "next" : "prev"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.src} alt={current.alt} />
        </figure>
      </div>

      {images.length > 1 ? (
        <div className="look-bar">
          <button
            type="button"
            className="look-nav"
            aria-label="Foto anterior"
            onClick={() => go(index - 1)}
          >
            <Chevron dir="prev" />
          </button>
          <div className="look-dots">
            {images.map((image, itemIndex) => (
              <button
                key={image.id}
                type="button"
                aria-label={image.alt}
                aria-current={itemIndex === index}
                className={itemIndex === index ? "on" : ""}
                onClick={() => go(itemIndex)}
              />
            ))}
          </div>
          <button
            type="button"
            className="look-nav"
            aria-label="Foto siguiente"
            onClick={() => go(index + 1)}
          >
            <Chevron dir="next" />
          </button>
        </div>
      ) : null}

      <button type="button" className="look-back" onClick={onBack}>
        Ver anillo
      </button>
    </div>
  );
}

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={dir === "next" ? "look-chev-next" : ""}>
      <path
        d="M14.5 5.5 8.5 12l6 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
