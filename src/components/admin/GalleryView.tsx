"use client";

import { useCallback, useEffect, useState } from "react";
import type { GalleryImage } from "@/commerce/types";
import {
  catalog,
  finishLabel,
  finishes,
  productPath,
  productTitle,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { compressImageBlob, isImageFile } from "@/lib/compressImage";
import { useAdminAuth } from "./AdminAuth";

type GalleryRow = { modelId: ModelId; images: GalleryImage[] };

export function GalleryView() {
  const { authorizedFetch } = useAdminAuth();
  const [rows, setRows] = useState<GalleryRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/gallery");
    const data = (await res.json()) as { galleries?: GalleryRow[] };
    setRows(data.galleries ?? []);
  }, [authorizedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh(res: Response) {
    let data: { ok?: boolean; error?: string; galleries?: GalleryRow[] } = {};
    try {
      data = (await res.json()) as { ok?: boolean; error?: string; galleries?: GalleryRow[] };
    } catch {
      throw new Error(res.ok ? "No se pudo leer la respuesta." : "No se pudo subir.");
    }
    if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo subir.");
    setRows(data.galleries ?? []);
  }

  async function uploadFiles(modelId: ModelId, finishId: FinishId, files: FileList | File[]) {
    const list = Array.from(files).filter(isImageFile);
    if (!list.length) {
      setError("Ese archivo no es una imagen. Usa JPG o PNG.");
      return;
    }
    const key = `${modelId}-${finishId}`;
    setBusy(key);
    setError("");
    try {
      for (const file of list) {
        const blob = await compressImageBlob(file);
        const body = new FormData();
        body.append("modelId", modelId);
        body.append("finishId", finishId);
        body.append("file", blob, file.name.replace(/\.[^.]+$/, "") + ".jpg");
        const res = await authorizedFetch("/api/admin/gallery", {
          method: "POST",
          body,
        });
        await refresh(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/gallery", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      await refresh(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setBusy(null);
    }
  }

  async function move(id: string, direction: "up" | "down") {
    setBusy(id);
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/gallery", {
        method: "PATCH",
        body: JSON.stringify({ id, direction }),
      });
      await refresh(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo mover.");
    } finally {
      setBusy(null);
    }
  }

  async function hide(id: string, hidden: boolean) {
    setBusy(id);
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/gallery", {
        method: "PATCH",
        body: JSON.stringify({ id, hidden }),
      });
      await refresh(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-5xl">
      <p className="text-[13px] text-[var(--admin-muted)]">Fotos</p>
      <h1 className="mt-1 text-[1.75rem] tracking-[-0.03em]">La piel de cada color</h1>
      <p className="mt-2 max-w-xl text-[14px] leading-6 text-[var(--admin-muted)]">
        Sube la secuencia de cada color. En el detalle, al tocar Lila o Oro, solo se ven esas
        fotos.
      </p>
      {error ? (
        <p className="sticky top-3 z-10 mt-4 rounded-2xl bg-[#fff2f1] px-4 py-3 text-sm text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-8 space-y-6">
        {catalog.map((product) => {
          const images = rows.find((row) => row.modelId === product.id)?.images ?? [];
          return (
            <section
              key={product.id}
              className="overflow-hidden rounded-[1.4rem] bg-white shadow-[var(--admin-shadow)]"
            >
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
                <div>
                  <h2 className="text-[17px] tracking-[-0.02em]">{productTitle(product.id)}</h2>
                  <p className="mt-0.5 text-[13px] text-[var(--admin-muted)]">
                    {product.finishes.length} colores
                  </p>
                </div>
                <a
                  href={productPath(product.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                >
                  Ver detalle
                </a>
              </div>

              <div className="divide-y divide-[var(--admin-line)]">
                {product.finishes.map((finishId) => {
                  const colorImages = images.filter(
                    (item) => !item.finishId || item.finishId === finishId,
                  );
                  const custom = colorImages.filter((item) => !item.system);
                  const house = colorImages.filter((item) => item.system);
                  const key = `${product.id}-${finishId}`;
                  const over = dragOver === key;
                  return (
                    <div key={finishId} className="px-5 py-5">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-7 w-7 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.55),0_0_0_1px_rgba(0,0,0,0.08)]"
                          style={{ background: finishes[finishId].swatch }}
                        />
                        <div>
                          <h3 className="text-[15px] tracking-[-0.02em]">
                            {finishLabel(product.id, finishId)}
                          </h3>
                          <p className="text-[12px] text-[var(--admin-muted)]">
                            {custom.length} propias
                            {house.some((item) => !item.hidden) ? " · foto de la casa" : ""}
                          </p>
                        </div>
                      </div>

                      <label
                        className={`mt-4 flex min-h-[6.5rem] cursor-pointer flex-col items-center justify-center rounded-[1.15rem] border border-dashed px-4 text-center transition-colors ${
                          over
                            ? "border-[var(--admin-ink)] bg-[var(--admin-field)]"
                            : "border-[var(--admin-line)] bg-[var(--admin-field)]/70"
                        }`}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragOver(key);
                        }}
                        onDragLeave={() =>
                          setDragOver((value) => (value === key ? null : value))
                        }
                        onDrop={(event) => {
                          event.preventDefault();
                          setDragOver(null);
                          void uploadFiles(product.id, finishId, event.dataTransfer.files);
                        }}
                      >
                        <span className="text-[14px] tracking-[-0.02em]">
                          {busy === key
                            ? "Subiendo…"
                            : `Fotos de ${finishLabel(product.id, finishId)}`}
                        </span>
                        <span className="mt-1 text-[12px] text-[var(--admin-muted)]">
                          Arrastra o elige. Varias a la vez.
                        </span>
                        <input
                          type="file"
                          accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                          multiple
                          className="sr-only"
                          disabled={busy === key}
                          onChange={(event) => {
                            const files = event.target.files;
                            event.target.value = "";
                            if (files) void uploadFiles(product.id, finishId, files);
                          }}
                        />
                      </label>

                      {custom.length ? (
                        <ImageGrid
                          title="Tus fotos"
                          images={custom}
                          busy={busy}
                          onMove={move}
                          onRemove={remove}
                        />
                      ) : null}

                      <ImageGrid title="De la casa" images={house} busy={busy} onHide={hide} />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ImageGrid({
  title,
  images,
  busy,
  onMove,
  onRemove,
  onHide,
}: {
  title: string;
  images: GalleryImage[];
  busy: string | null;
  onMove?: (id: string, direction: "up" | "down") => void;
  onRemove?: (id: string) => void;
  onHide?: (id: string, hidden: boolean) => void;
}) {
  if (!images.length) return null;
  return (
    <div className="mt-4">
      <p className="mb-3 text-[13px] text-[var(--admin-muted)]">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <article
            key={image.id}
            className={`overflow-hidden rounded-[1.15rem] bg-[var(--admin-field)] ${
              image.hidden ? "opacity-45" : ""
            }`}
          >
            <div className="relative aspect-[4/3] bg-[#ececee]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={`${title} ${index + 1}`}
                className="h-full w-full object-cover"
              />
              {image.system ? (
                <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white">
                  {image.hidden ? "Oculta" : "Casa"}
                </span>
              ) : (
                <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white">
                  {index + 1}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              {onMove ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onMove(image.id, "up")}
                    className="rounded-full px-2 py-1 text-[12px] text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(image.id, "down")}
                    className="rounded-full px-2 py-1 text-[12px] text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                  >
                    ↓
                  </button>
                </div>
              ) : (
                <span className="text-[12px] text-[var(--admin-muted)]">
                  {image.hidden ? "No se ve en este color." : "Sale con este color."}
                </span>
              )}
              {onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(image.id)}
                  className="text-[12px] text-[var(--admin-muted)] hover:text-[var(--admin-danger)]"
                >
                  {busy === image.id ? "…" : "Quitar"}
                </button>
              ) : null}
              {onHide ? (
                <button
                  type="button"
                  onClick={() => onHide(image.id, !image.hidden)}
                  className="text-[12px] text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                >
                  {busy === image.id ? "…" : image.hidden ? "Mostrar" : "Ocultar"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
