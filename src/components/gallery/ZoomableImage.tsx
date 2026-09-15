"use client";

import { useEffect, useRef, useState } from "react";

const MIN = 1;
const MAX = 4;

type ZoomableImageProps = {
  src: string;
  alt: string;
};

export function ZoomableImage({ src, alt }: ZoomableImageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const view = useRef({ scale: 1, tx: 0, ty: 0 });
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [live, setLive] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  function commit(next: { scale: number; tx: number; ty: number }) {
    view.current = next;
    setScale(next.scale);
    setTx(next.tx);
    setTy(next.ty);
  }

  function clampPan(nextScale: number, nextTx: number, nextTy: number) {
    const node = stage.current;
    if (!node) return { tx: nextTx, ty: nextTy };
    const { width, height } = node.getBoundingClientRect();
    const maxX = ((nextScale - 1) * width) / 2;
    const maxY = ((nextScale - 1) * height) / 2;
    return {
      tx: Math.min(maxX, Math.max(-maxX, nextTx)),
      ty: Math.min(maxY, Math.max(-maxY, nextTy)),
    };
  }

  function applyScale(nextScale: number, cx: number, cy: number) {
    const node = stage.current;
    if (!node) return;
    const current = view.current;
    const rect = node.getBoundingClientRect();
    const px = cx - rect.left - rect.width / 2;
    const py = cy - rect.top - rect.height / 2;
    const clamped = Math.min(MAX, Math.max(MIN, nextScale));
    const ratio = clamped / current.scale;
    const pan = clampPan(
      clamped,
      (current.tx - px) * ratio + px,
      (current.ty - py) * ratio + py,
    );
    commit({
      scale: clamped,
      tx: clamped === 1 ? 0 : pan.tx,
      ty: clamped === 1 ? 0 : pan.ty,
    });
  }

  useEffect(() => {
    commit({ scale: 1, tx: 0, ty: 0 });
    setLive(false);
    pointers.current.clear();
    pinch.current = null;
    drag.current = null;
  }, [src]);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 0.88;
      applyScale(view.current.scale * factor, event.clientX, event.clientY);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={stage}
      className={`relative h-full w-full touch-none overflow-hidden ${
        scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
      }`}
      onDoubleClick={(event) => {
        if (view.current.scale > 1) {
          commit({ scale: 1, tx: 0, ty: 0 });
          return;
        }
        applyScale(2.35, event.clientX, event.clientY);
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        setLive(true);
        if (pointers.current.size === 2) {
          const pts = [...pointers.current.values()];
          pinch.current = {
            distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
            scale: view.current.scale,
          };
          drag.current = null;
        } else if (view.current.scale > 1) {
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            tx: view.current.tx,
            ty: view.current.ty,
          };
        }
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size === 2 && pinch.current) {
          const pts = [...pointers.current.values()];
          const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          applyScale(
            pinch.current.scale * (distance / pinch.current.distance),
            (pts[0].x + pts[1].x) / 2,
            (pts[0].y + pts[1].y) / 2,
          );
          return;
        }
        if (drag.current && view.current.scale > 1) {
          const pan = clampPan(
            view.current.scale,
            drag.current.tx + (event.clientX - drag.current.x),
            drag.current.ty + (event.clientY - drag.current.y),
          );
          commit({ scale: view.current.scale, ...pan });
        }
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        pinch.current = null;
        drag.current = null;
        if (pointers.current.size === 0) setLive(false);
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        pinch.current = null;
        drag.current = null;
        setLive(false);
      }}
    >
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          transition: live ? "none" : "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt={alt}
          draggable={false}
          className="gallery-image-in h-full w-full select-none object-cover"
        />
      </div>
      <p className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-[11px] uppercase tracking-[0.14em] text-ink/35 sm:block">
        {scale > 1 ? "Doble clic para soltar" : "Rueda o pellizca para acercar"}
      </p>
    </div>
  );
}
