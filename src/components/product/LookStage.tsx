"use client";

import { useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/commerce/types";
import { PRODUCT_LOOKS, products, type ModelId } from "@/lib/catalog";

type LookImage = { id: string; src: string; alt: string };

function fallbackLooks(modelId: ModelId): LookImage[] {
  const name = `Mora ${products[modelId].name}`;
  const looks = PRODUCT_LOOKS[modelId].map((item) => ({
    id: item.id,
    src: item.src,
    alt: name,
  }));
  if (modelId === "aero") {
    return [
      ...looks,
      { id: "pro-lilac", src: "/encuesta/lila.jpg", alt: `${name} Lila` },
      { id: "pro-white", src: "/encuesta/blanco.jpg", alt: `${name} Blanco` },
      { id: "pro-black", src: "/encuesta/mate.jpg", alt: `${name} Negro` },
    ];
  }
  return [
    ...looks,
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
  for (const item of [...fallbackLooks(modelId), ...uploaded]) {
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
    lock.current = true;
    setPrev(index);
    setIndex(wrapped);
    window.setTimeout(() => {
      setPrev(null);
      lock.current = false;
    }, 520);
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
      <div className="look-atmosphere" aria-hidden>
        {leaving ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`bloom-leave-${leaving.id}`}
            className="look-bloom look-bloom-leave"
            src={leaving.src}
            alt=""
          />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`bloom-${current.id}`}
          className="look-bloom look-bloom-in"
          src={current.src}
          alt=""
        />
        <div className="look-veil" />
      </div>

      <button type="button" className="look-head" onClick={onBack}>
        Anillo
      </button>

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
        {images.length > 1 ? (
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
        {leaving ? (
          <LookSlide
            key={`leave-${leaving.id}`}
            src={leaving.src}
            alt=""
            className="look-fade-out"
            hidden
          />
        ) : null}
        <LookSlide
          key={current.id}
          src={current.src}
          alt={current.alt}
          className={prev != null ? "look-fade-in" : ""}
        />
      </div>

      {images.length > 1 ? (
        <nav className="look-bar" aria-label="Fotos">
          <button
            type="button"
            className="look-arrow"
            aria-label="Foto anterior"
            onClick={() => go(index - 1)}
          >
            <LookArrow />
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
            className="look-arrow look-arrow-next"
            aria-label="Foto siguiente"
            onClick={() => go(index + 1)}
          >
            <LookArrow />
          </button>
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
        <img className="look-photo" src={src} alt={alt} />
      </div>
    </figure>
  );
}

function LookArrow() {
  return (
    <svg viewBox="0 0 22 22" aria-hidden>
      <path
        d="M13.2 4.8 6.6 11l6.6 6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
