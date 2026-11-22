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
 * Una foto por color, en el orden de la tienda.
 * Gana la primera de la galería de ese color; si no hay, la de fábrica.
 */
export function colorShots(modelId: ModelId, images: GalleryImage[]): ColorShot[] {
  const pool = images.filter((image) => image.modelId === modelId && !image.hidden && image.finishId);
  return products[modelId].finishes.map((finishId) => {
    const shot = pool.find((image) => image.finishId === finishId);
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
