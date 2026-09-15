import { randomUUID } from "crypto";
import type { DocumentData } from "firebase-admin/firestore";
import type { GalleryImage } from "@/commerce/types";
import { COLLECTIONS } from "@/commerce/paths";
import { defaultGalleryImage, products, type ModelId } from "@/lib/catalog";
import { adminDb } from "@/lib/firebaseAdmin";

const MAX_IMAGES = 16;
const MAX_DATA_URL_CHARS = 1_400_000;

function isModelId(value: unknown): value is ModelId {
  return value === "aero" || value === "titan";
}

function galleryCol() {
  return adminDb().collection(COLLECTIONS.gallery);
}

function asImage(id: string, data: DocumentData | undefined): GalleryImage | null {
  if (!data || !isModelId(data.modelId) || typeof data.src !== "string") return null;
  return {
    id,
    modelId: data.modelId,
    src: data.src,
    sort: Number(data.sort ?? 0),
    createdAt: Number(data.createdAt ?? 0),
    system: data.system === true,
  };
}

export async function listGallery(modelId: ModelId): Promise<GalleryImage[]> {
  try {
    const snap = await galleryCol().where("modelId", "==", modelId).get();
    const uploaded = snap.docs
      .map((doc) => asImage(doc.id, doc.data()))
      .filter((item): item is GalleryImage => Boolean(item && !item.system))
      .sort((a, b) => a.sort - b.sort || a.createdAt - b.createdAt);
    return [defaultGalleryImage(modelId), ...uploaded];
  } catch {
    return [defaultGalleryImage(modelId)];
  }
}

export async function listAllGalleries() {
  const entries = await Promise.all(
    (Object.keys(products) as ModelId[]).map(async (modelId) => ({
      modelId,
      images: await listGallery(modelId),
    })),
  );
  return entries;
}

export async function addGalleryImage(input: {
  modelId: ModelId;
  src: string;
}): Promise<GalleryImage> {
  if (!isModelId(input.modelId)) {
    throw Object.assign(new Error("Anillo inválido."), { status: 400 });
  }
  if (!input.src.startsWith("data:image/")) {
    throw Object.assign(new Error("Solo se aceptan imágenes."), { status: 400 });
  }
  if (input.src.length > MAX_DATA_URL_CHARS) {
    throw Object.assign(new Error("La imagen pesa demasiado. Prueba una más ligera."), {
      status: 400,
    });
  }

  const current = await listGallery(input.modelId);
  if (current.length >= MAX_IMAGES) {
    throw Object.assign(new Error("Máximo 16 imágenes por anillo."), { status: 400 });
  }

  const now = Date.now();
  const image: GalleryImage = {
    id: randomUUID(),
    modelId: input.modelId,
    src: input.src,
    sort: current.length,
    createdAt: now,
  };
  await galleryCol().doc(image.id).set(image);
  return image;
}

export async function removeGalleryImage(id: string) {
  if (id.startsWith("default-")) {
    throw Object.assign(new Error("La primera imagen de la casa no se borra."), {
      status: 400,
    });
  }
  const ref = galleryCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error("Imagen no encontrada."), { status: 404 });
  }
  await ref.delete();
}

export async function moveGalleryImage(id: string, direction: "up" | "down") {
  const ref = galleryCol().doc(id);
  const snap = await ref.get();
  const current = asImage(id, snap.data());
  if (!current || current.system) {
    throw Object.assign(new Error("Esa imagen no se puede mover."), { status: 400 });
  }

  const siblings = (await listGallery(current.modelId)).filter((item) => !item.system);
  const index = siblings.findIndex((item) => item.id === id);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  const swap = siblings[nextIndex];
  if (!swap) return siblings;

  const batch = adminDb().batch();
  batch.set(galleryCol().doc(current.id), { sort: swap.sort }, { merge: true });
  batch.set(galleryCol().doc(swap.id), { sort: current.sort }, { merge: true });
  await batch.commit();
  return listGallery(current.modelId);
}

export { isModelId };
