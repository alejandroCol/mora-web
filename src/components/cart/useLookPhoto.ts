"use client";

import { useEffect, useState } from "react";
import type { GalleryImage } from "@/commerce/types";
import { products, type FinishId, type ModelId } from "@/lib/catalog";

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<void>>();

function keyOf(modelId: ModelId, finishId: FinishId) {
  return `${modelId}:${finishId}`;
}

function pickFirst(images: GalleryImage[], finishId: FinishId) {
  return (
    images.find(
      (item) => !item.system && !item.hidden && (!item.finishId || item.finishId === finishId),
    )?.src ?? null
  );
}

function hydrate(modelId: ModelId, images: GalleryImage[]) {
  for (const finishId of products[modelId].finishes) {
    cache.set(keyOf(modelId, finishId), pickFirst(images, finishId));
  }
}

function loadModel(modelId: ModelId) {
  const pending = inflight.get(modelId);
  if (pending) return pending;
  const task = fetch(`/api/gallery?model=${modelId}`)
    .then(async (res) => (await res.json()) as { images?: GalleryImage[] })
    .then((data) => {
      hydrate(modelId, data.images ?? []);
    })
    .catch(() => {
      for (const finishId of products[modelId].finishes) {
        const key = keyOf(modelId, finishId);
        if (!cache.has(key)) cache.set(key, null);
      }
    })
    .finally(() => {
      inflight.delete(modelId);
    });
  inflight.set(modelId, task);
  return task;
}

export function useLookPhoto(modelId: ModelId, finishId: FinishId) {
  const key = keyOf(modelId, finishId);
  const [src, setSrc] = useState<string | null>(() => (cache.has(key) ? cache.get(key) ?? null : null));

  useEffect(() => {
    if (cache.has(key)) {
      setSrc(cache.get(key) ?? null);
      return;
    }
    let alive = true;
    void loadModel(modelId).then(() => {
      if (alive) setSrc(cache.get(key) ?? null);
    });
    return () => {
      alive = false;
    };
  }, [key, modelId]);

  return src;
}
