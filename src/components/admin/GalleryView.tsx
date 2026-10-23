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
import { compressImageBlob } from "@/lib/compressImage";
import { useAdminAuth } from "./AdminAuth";

type GalleryRow = { modelId: ModelId; images: GalleryImage[] };
type CopyMap = Record<ModelId, string>;

function placeCustom(images: GalleryImage[], finishId: FinishId, orderedIds: string[]) {
  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  const custom = images.filter((item) => !item.system && item.finishId === finishId);
  const sorted = [...custom].sort(
    (a, b) => (rank.get(a.id) ?? custom.length) - (rank.get(b.id) ?? custom.length),
  );
  let cursor = 0;
  return images.map((item) => {
    if (!item.system && item.finishId === finishId) return sorted[cursor++] ?? item;
    return item;
  });
}

export function GalleryView() {
  const { authorizedFetch } = useAdminAuth();
  const [rows, setRows] = useState<GalleryRow[]>([]);
  const [copy, setCopy] = useState<CopyMap>({ aero: "", titan: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/gallery");
    const data = (await res.json()) as { galleries?: GalleryRow[]; descriptions?: CopyMap };
    setRows(data.galleries ?? []);
    if (data.descriptions) setCopy(data.descriptions);
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
    const list = Array.from(files);
    if (!list.length) {
      setError("No llegó el archivo. Arrástralo a esta caja o elige de nuevo.");
      return;
    }
    const key = `${modelId}-${finishId}`;
    setBusy(key);
    setError("");
    try {
      for (const file of list) {
        const blob = await compressImageBlob(file, 2560, 0.92);
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        const body = new FormData();
        body.append("modelId", modelId);
        body.append("finishId", finishId);
        body.append("file", blob, `${file.name.replace(/\.[^.]+$/, "") || "foto"}.${ext}`);
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
    if (!window.confirm("¿Eliminar esta foto? No se puede deshacer.")) return;
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

  async function reorder(modelId: ModelId, finishId: FinishId, orderedIds: string[]) {
    setRows((current) =>
      current.map((row) =>
        row.modelId === modelId
          ? { ...row, images: placeCustom(row.images, finishId, orderedIds) }
          : row,
      ),
    );
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/gallery", {
        method: "PATCH",
        body: JSON.stringify({ modelId, finishId, order: orderedIds }),
      });
      await refresh(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ordenar.");
      await load();
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

  async function saveDescription(modelId: ModelId) {
    setBusy(`copy-${modelId}`);
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/gallery", {
        method: "PATCH",
        body: JSON.stringify({ modelId, description: copy[modelId] ?? "" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; descriptions?: CopyMap };
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
      if (data.descriptions) setCopy(data.descriptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-5xl">
      <p className="text-[13px] text-[var(--admin-muted)]">Fotos</p>
      <h1 className="mt-1 text-[1.75rem] tracking-[-0.03em]">La piel de cada color</h1>
      <p className="mt-2 max-w-xl text-[14px] leading-6 text-[var(--admin-muted)]">
        Sube la secuencia de cada color. Ocúltala si no quieres que salga, o elimínala. La
        descripción previa es el texto corto del detalle. La ficha técnica se abre al expandir.
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
              <div className="border-b border-[var(--admin-line)] px-5 py-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
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
                <label className="mt-4 block">
                  <span className="text-[12px] text-[var(--admin-muted)]">Descripción previa</span>
                  <span className="mt-1 block text-[12px] leading-5 text-[var(--admin-muted)]">
                    Se ve siempre, bajo el nombre. «Ver toda la descripción» abre la ficha con las
                    tablas.
                  </span>
                  <textarea
                    value={copy[product.id] ?? ""}
                    rows={3}
                    maxLength={400}
                    onChange={(event) =>
                      setCopy((current) => ({ ...current, [product.id]: event.target.value }))
                    }
                    className="mt-1.5 w-full resize-none rounded-2xl border border-[var(--admin-line)] bg-[var(--admin-field)] px-3 py-2.5 text-[14px] leading-5 outline-none focus:border-[var(--admin-ink)]"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy === `copy-${product.id}`}
                  onClick={() => void saveDescription(product.id)}
                  className="mt-2 text-[13px] text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                >
                  {busy === `copy-${product.id}` ? "…" : "Guardar descripción previa"}
                </button>
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

                      <div
                        className={`relative mt-4 flex min-h-[6.5rem] flex-col items-center justify-center rounded-[1.15rem] border border-dashed px-4 text-center transition-colors ${
                          over
                            ? "border-[var(--admin-ink)] bg-[var(--admin-field)]"
                            : "border-[var(--admin-line)] bg-[var(--admin-field)]/70"
                        }`}
                        onDragOver={(event) => {
                          if (![...event.dataTransfer.types].includes("Files")) return;
                          event.preventDefault();
                          setDragOver(key);
                        }}
                        onDragLeave={() =>
                          setDragOver((value) => (value === key ? null : value))
                        }
                        onDrop={(event) => {
                          event.preventDefault();
                          setDragOver(null);
                          const files = Array.from(event.dataTransfer.files);
                          if (files.length) void uploadFiles(product.id, finishId, files);
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={busy === key}
                          className="absolute inset-0 z-10 cursor-pointer opacity-0"
                          onChange={(event) => {
                            const input = event.currentTarget;
                            const picked = Array.from(input.files ?? []);
                            input.value = "";
                            if (picked.length) void uploadFiles(product.id, finishId, picked);
                          }}
                        />
                        <span className="pointer-events-none text-[14px] tracking-[-0.02em]">
                          {busy === key
                            ? "Subiendo…"
                            : `Fotos de ${finishLabel(product.id, finishId)}`}
                        </span>
                        <span className="pointer-events-none mt-1 text-[12px] text-[var(--admin-muted)]">
                          Arrastra o elige. Varias a la vez.
                        </span>
                      </div>

                      {custom.length ? (
                        <ImageGrid
                          title="Tus fotos"
                          images={custom}
                          busy={busy}
                          onMove={move}
                          onRemove={remove}
                          onHide={hide}
                          onReorder={(orderedIds) => void reorder(product.id, finishId, orderedIds)}
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
  onReorder,
}: {
  title: string;
  images: GalleryImage[];
  busy: string | null;
  onMove?: (id: string, direction: "up" | "down") => void;
  onRemove?: (id: string) => void;
  onHide?: (id: string, hidden: boolean) => void;
  onReorder?: (orderedIds: string[]) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  if (!images.length) return null;

  function finishDrag() {
    setDraggingId(null);
    setDropId(null);
  }

  function dropOn(targetId: string, fromId: string | null) {
    finishDrag();
    if (!fromId || fromId === targetId || !onReorder) return;
    const ids = images.map((item) => item.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, fromId);
    onReorder(ids);
  }

  return (
    <div className="mt-4">
      <p className={`text-[13px] text-[var(--admin-muted)] ${onReorder ? "mb-1" : "mb-3"}`}>
        {title}
      </p>
      {onReorder ? (
        <p className="mb-3 text-[12px] leading-5 text-[var(--admin-muted)]">
          Arrastra una foto sobre otra para cambiar el orden. La 1 se ve primero.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <article
            key={image.id}
            onDragOver={(event) => {
              if (!draggingId || draggingId === image.id) return;
              event.preventDefault();
              setDropId(image.id);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              setDropId((current) => (current === image.id ? null : current));
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const fromId = event.dataTransfer.getData("text/plain") || draggingId;
              dropOn(image.id, fromId);
            }}
            className={`overflow-hidden rounded-[1.15rem] bg-[var(--admin-field)] ${
              image.hidden ? "opacity-45" : ""
            } ${dropId === image.id && draggingId !== image.id ? "ring-2 ring-[var(--admin-ink)]" : ""}`}
          >
            <div
              draggable={Boolean(onReorder)}
              onDragStart={(event) => {
                if (!onReorder) return;
                event.dataTransfer.setData("text/plain", image.id);
                event.dataTransfer.effectAllowed = "move";
                setDraggingId(image.id);
              }}
              onDragEnd={finishDrag}
              className={`relative aspect-[4/3] bg-[#ececee] ${
                onReorder ? "cursor-grab active:cursor-grabbing" : ""
              } ${draggingId === image.id ? "opacity-40" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={`${title} ${index + 1}`}
                draggable={false}
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
                    aria-label="Mover antes"
                    disabled={index === 0 || busy === image.id}
                    onClick={() => onMove(image.id, "up")}
                    className="rounded-full px-2 py-1 text-[12px] text-[var(--admin-muted)] hover:text-[var(--admin-ink)] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Mover después"
                    disabled={index === images.length - 1 || busy === image.id}
                    onClick={() => onMove(image.id, "down")}
                    className="rounded-full px-2 py-1 text-[12px] text-[var(--admin-muted)] hover:text-[var(--admin-ink)] disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              ) : (
                <span className="text-[12px] text-[var(--admin-muted)]">
                  {image.hidden ? "No se ve en este color." : "Sale con este color."}
                </span>
              )}
              <div className="flex shrink-0 items-center gap-3">
                {onHide ? (
                  <button
                    type="button"
                    onClick={() => onHide(image.id, !image.hidden)}
                    className="text-[12px] text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                  >
                    {busy === image.id ? "…" : image.hidden ? "Mostrar" : "Ocultar"}
                  </button>
                ) : null}
                {onRemove ? (
                  <button
                    type="button"
                    onClick={() => onRemove(image.id)}
                    className="text-[12px] text-[var(--admin-danger)] hover:underline"
                  >
                    {busy === image.id ? "…" : "Eliminar"}
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
