"use client";

import { useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/commerce/types";
import {
  catalog,
  finishLabel,
  productTitle,
  resolveFinish,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { OUTBOUND_MEDIA } from "@/crm/media";

type Galleries = Record<ModelId, GalleryImage[]>;

/** Lado mayor del JPG que sale por WhatsApp: se ve nítido en el chat y pesa poco. */
const MAX_SIDE = 1600;

/** La tienda guarda WebP; WhatsApp lo trataría como sticker. Se reenvía como JPG. */
async function asJpeg(src: string, name: string): Promise<File> {
  const response = await fetch(src);
  if (!response.ok) throw new Error("No se pudo traer la foto.");
  const bitmap = await createImageBitmap(await response.blob());
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la foto.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.88, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= OUTBOUND_MEDIA.image.maxBytes) {
      return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
    }
  }
  throw new Error("La foto pesa demasiado.");
}

function fileName(modelId: ModelId, finishId: FinishId) {
  return `${productTitle(modelId)} ${finishLabel(modelId, finishId)}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

export function CrmStorePhotos({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (file: File, caption: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [galleries, setGalleries] = useState<Galleries | null>(null);
  const [modelId, setModelId] = useState<ModelId>("aero");
  const [finishId, setFinishId] = useState<FinishId>(catalog[0].finishes[0]);
  const [loading, setLoading] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || galleries) return;
    let alive = true;
    fetch("/api/gallery")
      .then((response) => response.json())
      .then((data: { galleries?: { modelId: ModelId; images: GalleryImage[] }[] }) => {
        if (!alive) return;
        const next = { aero: [], titan: [] } as Galleries;
        for (const entry of data.galleries ?? []) next[entry.modelId] = entry.images;
        setGalleries(next);
      })
      .catch(() => alive && setProblem("No se pudieron cargar las fotos."));
    return () => {
      alive = false;
    };
  }, [open, galleries]);

  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const product = catalog.find((item) => item.id === modelId) ?? catalog[0];
  const photos = (galleries?.[modelId] ?? []).filter((image) => image.finishId === finishId);

  function chooseModel(next: ModelId) {
    setModelId(next);
    const finishes = catalog.find((item) => item.id === next)?.finishes ?? [];
    if (!finishes.includes(finishId)) setFinishId(finishes[0]);
  }

  async function choose(image: GalleryImage) {
    if (loading) return;
    setLoading(image.id);
    setProblem("");
    try {
      const file = await asJpeg(image.src, fileName(modelId, finishId));
      onPick(file, `${productTitle(modelId)} · ${finishLabel(modelId, finishId)}`);
      setOpen(false);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo adjuntar la foto.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="crm-photos" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-label="Fotos de la tienda"
        aria-expanded={open}
        title="Fotos de la tienda"
        className="crm-composer-tool"
      >
        <RingGlyph />
      </button>
      {open ? (
        <div className="crm-photos-pop" role="dialog" aria-label="Fotos de la tienda">
          <div className="crm-photos-models">
            {catalog.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseModel(item.id)}
                className={item.id === modelId ? "is-on" : ""}
              >
                {productTitle(item.id)}
              </button>
            ))}
          </div>
          <div className="crm-photos-colors">
            {product.finishes.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFinishId(id)}
                className={id === finishId ? "is-on" : ""}
              >
                <span style={{ background: resolveFinish(modelId, id).swatch }} aria-hidden />
                {finishLabel(modelId, id)}
              </button>
            ))}
          </div>
          {!galleries && !problem ? <p className="crm-photos-note">Cargando…</p> : null}
          {galleries && photos.length === 0 ? (
            <p className="crm-photos-note">Este color aún no tiene fotos en la tienda.</p>
          ) : null}
          <div className="crm-photos-grid">
            {photos.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => void choose(image)}
                disabled={Boolean(loading)}
                className={loading === image.id ? "is-loading" : ""}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          {problem ? <p className="crm-photos-note text-red-500">{problem}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function RingGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="12" cy="12.5" r="3.6" />
      <path d="M10.2 6.9h3.6" strokeLinecap="round" />
    </svg>
  );
}
