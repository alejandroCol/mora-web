import type { GalleryImage } from "@/commerce/types";
import {
  finishLabel,
  finishPhoto,
  formatMoney,
  productTitle,
  products,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";

export type ColorShot = {
  finishId: FinishId;
  /** Pie de la foto: solo el color. El precio va en el mensaje de después. */
  label: string;
  src: string;
  fileName: string;
};

/**
 * La foto en la que alguien lleva ese color puesto.
 * Si se borra de la galería, se usa otra del mismo color en la que también se vea puesto.
 */
const WORN_SHOT: Record<ModelId, Partial<Record<FinishId, string>>> = {
  aero: {
    lilac: "08a3b8a8-41a4-42dc-a1af-bc970e0c0fc6",
    white: "120944a0-fb07-493c-afb8-e0c4016e3f10",
    black: "ba265d99-46c2-494a-906f-5ce763737770",
  },
  titan: {
    silver: "5941deed-e9b8-46cf-9b60-926d90f01426",
    black: "080d3661-973c-482c-853e-4eb8d562b5db",
    gold: "31f72864-3629-4ef2-b6cb-c0dbb8c2e322",
  },
};

/** El anillo solo, sin nadie. No se manda si hay una foto de alguien llevándolo. */
const RING_ALONE = new Set([
  "aedfb539-e20e-4592-80a3-04c28e4c8ee2",
  "9aa25f70-3b3b-48f8-8351-f58cfd5c6294",
  "bcb4c649-5737-402f-8cd4-f2f381e51bdf",
  "685fe9e3-d925-4a40-a2a6-dc2f5d7cac9f",
  "df735bf2-a77f-44ae-840e-cfcd77904b99",
  "9ac3f9c1-ff8e-47d3-85bc-369d5242e5e7",
  "2db08499-91a8-4078-bfc2-b61a023055bd",
]);

/**
 * Una foto por color: alguien con el anillo puesto.
 * Si ese color no tiene ninguna así, va la de fábrica.
 */
export function colorShots(modelId: ModelId, images: GalleryImage[]): ColorShot[] {
  const pool = images.filter((image) => image.modelId === modelId && !image.hidden && image.finishId);
  return products[modelId].finishes.map((finishId) => {
    const ofColor = pool.filter((image) => image.finishId === finishId);
    const preferred = WORN_SHOT[modelId][finishId];
    const shot =
      ofColor.find((image) => image.id === preferred) ??
      ofColor.find((image) => !RING_ALONE.has(image.id)) ??
      ofColor[0];
    const label = finishLabel(modelId, finishId);
    return {
      finishId,
      label,
      src: shot?.src ?? finishPhoto(finishId),
      fileName: jpegName(modelId, finishId),
    };
  });
}

/** Último mensaje del atajo: el precio, y una pregunta para que respondan. */
export function colorPitchClose(modelId: ModelId, price: number, listPrice?: number) {
  const name = productTitle(modelId);
  const deal =
    listPrice != null && listPrice > price
      ? `${formatMoney(price)} (antes ${formatMoney(listPrice)})`
      : formatMoney(price);
  return `${name} queda en ${deal}.\n¿Cuál te gusta?`;
}

function jpegName(modelId: ModelId, finishId: FinishId) {
  return `${productTitle(modelId)} ${finishLabel(modelId, finishId)}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
