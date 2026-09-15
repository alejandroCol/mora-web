"use client";

import { useCallback, useEffect, useState } from "react";
import type { GalleryImage } from "@/commerce/types";
import { catalog, products, type ModelId } from "@/lib/catalog";
import { compressImage } from "@/lib/compressImage";
import { useAdminAuth } from "./AdminAuth";

type GalleryRow = { modelId: ModelId; images: GalleryImage[] };

export function GalleryView() {
  const { authorizedFetch } = useAdminAuth();
  const [rows, setRows] = useState<GalleryRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/gallery");
    const data = (await res.json()) as { galleries?: GalleryRow[] };
    setRows(data.galleries ?? []);
  }, [authorizedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh(res: Response) {
    const data = (await res.json()) as { ok?: boolean; error?: string; galleries?: GalleryRow[] };
    if (!data.ok) throw new Error(data.error);
    setRows(data.galleries ?? []);
  }

  async function upload(modelId: ModelId, file: File) {
    setBusy(modelId);
    setError("");
    try {
      const src = await compressImage(file);
      const res = await authorizedFetch("/api/admin/gallery", {
        method: "POST",
        body: JSON.stringify({ modelId, src }),
      });
      await refresh(res);
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

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Galería</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">La piel de cada anillo.</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
        La primera foto es de la casa. Las que subas se ven después, en el mismo silencio.
      </p>
      {error ? <p className="mt-4 text-sm text-rose-200/80">{error}</p> : null}

      <div className="mt-10 space-y-12">
        {catalog.map((product) => {
          const images = rows.find((row) => row.modelId === product.id)?.images ?? [];
          return (
            <section key={product.id}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl tracking-[-0.03em]">{product.name}</h2>
                  <p className="mt-1 text-[13px] text-white/40">{product.line}</p>
                </div>
                <label className="cursor-pointer rounded-full bg-white px-4 py-2 text-[13px] text-[#0e0d14]">
                  {busy === product.id ? "Subiendo…" : "Añadir foto"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={busy === product.id}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void upload(product.id, file);
                    }}
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((image, index) => (
                  <article
                    key={image.id}
                    className="overflow-hidden rounded-[1.4rem] bg-white/[0.04]"
                  >
                    <div className="relative aspect-[4/3] bg-[#16141f]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.src}
                        alt={`${products[image.modelId].name} ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {image.system ? (
                        <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/80">
                          Primera
                        </span>
                      ) : null}
                    </div>
                    {!image.system ? (
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => void move(image.id, "up")}
                            className="rounded-full px-2 py-1 text-[12px] text-white/45 hover:text-white"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => void move(image.id, "down")}
                            className="rounded-full px-2 py-1 text-[12px] text-white/45 hover:text-white"
                          >
                            ↓
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => void remove(image.id)}
                          className="text-[12px] text-white/40 hover:text-white"
                        >
                          {busy === image.id ? "…" : "Quitar"}
                        </button>
                      </div>
                    ) : (
                      <p className="px-3 py-2.5 text-[12px] text-white/35">Se queda al frente.</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
