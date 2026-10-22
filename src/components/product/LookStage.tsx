"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/commerce/types";
import {
  defaultGalleryImages,
  finishLabel,
  products,
  resolveFinish,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { useInsightImage } from "@/insights/client";
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
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const finishId =
    ready && model.finishes.includes(selection.finishId)
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
  const [railOut, setRailOut] = useState(false);
  const [belowBar, setBelowBar] = useState(false);
  const swipe = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const railOutRef = useRef(false);
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
  useInsightImage({
    productId: model.id,
    productName: model.name,
    imageId:
      current?.kind === "ring" ? `ring-${modelId}-${finishId}` : current?.id ?? "",
    imageSrc: current?.kind === "photo" ? current.src : undefined,
    finishId,
    kind: current?.kind === "ring" ? "ring" : "photo",
    label:
      current?.kind === "ring"
        ? `${model.name} · anillo 3D`
        : `${model.name} · ${finishLabel(modelId, finishId)}`,
  });

  const placeRail = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      railOutRef.current = false;
      setRailOut(false);
      setBelowBar(false);
      stage.style.removeProperty("--look-rail-left");
      return;
    }

    const media = stage.querySelector<HTMLElement>(".look-photo, .look-ring canvas");
    const box = stage.getBoundingClientRect();
    const header = 68;
    const enter = 96;
    const leave = 72;

    let aspect = 1;
    if (media instanceof HTMLImageElement && media.naturalWidth && media.naturalHeight) {
      aspect = media.naturalWidth / media.naturalHeight;
    } else if (media) {
      const drawn = media.getBoundingClientRect();
      if (drawn.height > 1) aspect = drawn.width / drawn.height;
    }

    const hBar = Math.max(1, box.height - header);
    const wBar = Math.min(box.width, hBar * aspect);
    const gapBar = box.width - wBar;
    const wFull = Math.min(box.width, box.height * aspect);
    const gapFull = box.width - wFull;
    const useBar = gapBar > 12;
    const gap = useBar ? gapBar : gapFull;
    const nextOut = railOutRef.current ? gap >= leave : gap >= enter;

    railOutRef.current = nextOut;
    setBelowBar(useBar);
    setRailOut(nextOut);
    stage.style.setProperty(
      "--look-rail-left",
      `${nextOut ? 0 : Math.max(0, box.width - (useBar ? wBar : wFull))}px`,
    );
  }, []);

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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sync = () => placeRail();
    sync();
    const frame = window.requestAnimationFrame(sync);
    const later = window.setTimeout(sync, 120);
    const observer = new ResizeObserver(sync);
    observer.observe(stage);
    const media = stage.querySelector(".look-photo, .look-ring canvas");
    if (media) observer.observe(media);
    window.addEventListener("resize", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(later);
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [index, current?.kind, placeRail]);

  if (!current) return null;

  const leavingPhoto = leaving?.kind === "photo" ? leaving : null;

  return (
    <div
      ref={stageRef}
      className={`look-stage${belowBar ? " look-below-bar" : ""}${railOut ? " rail-out" : ""}`}
    >
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
              modelId={modelId}
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
            onReady={placeRail}
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
                    style={{ background: resolveFinish(modelId, finishId).swatch }}
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
  onReady,
}: {
  src: string;
  alt: string;
  className: string;
  hidden?: boolean;
  onReady?: () => void;
}) {
  return (
    <figure
      className={`look-slide ${className}`}
      aria-hidden={hidden || undefined}
    >
      <div className="look-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="look-photo"
          src={src}
          alt={alt}
          decoding="async"
          onLoad={onReady}
        />
      </div>
    </figure>
  );
}
