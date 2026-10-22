import { randomUUID } from "crypto";
import type { DocumentData } from "firebase-admin/firestore";
import type { GalleryImage } from "@/commerce/types";
import { COLLECTIONS } from "@/commerce/paths";
import {
  defaultGalleryImages,
  isFinishId,
  isProductFinish,
  products,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { adminBucket, adminDb } from "@/lib/firebaseAdmin";

const MAX_IMAGES = 24;
const MAX_DATA_URL_CHARS = 900_000;

function isModelId(value: unknown): value is ModelId {
  return value === "aero" || value === "titan";
}

function galleryCol() {
  return adminDb().collection(COLLECTIONS.gallery);
}

function galleryObjectPath(modelId: ModelId, finishId: FinishId, id: string) {
  return `gallery/${modelId}/${finishId}/${id}.jpg`;
}

function parseDataUrl(raw: string) {
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw Object.assign(new Error("Solo se aceptan imágenes."), { status: 400 });
  }
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

function asImage(id: string, data: DocumentData | undefined): GalleryImage | null {
  if (!data || !isModelId(data.modelId) || typeof data.src !== "string") return null;
  const finishId = isFinishId(data.finishId) ? data.finishId : undefined;
  return {
    id,
    modelId: data.modelId,
    finishId,
    src: data.src,
    sort: Number(data.sort ?? 0),
    createdAt: Number(data.createdAt ?? 0),
    system: data.system === true,
    hidden: data.hidden === true,
    storagePath: typeof data.storagePath === "string" ? data.storagePath : undefined,
    mime: typeof data.mime === "string" ? data.mime : undefined,
  };
}

function sortImages(a: GalleryImage, b: GalleryImage) {
  return a.sort - b.sort || a.createdAt - b.createdAt;
}

function matchesFinish(image: GalleryImage, finishId?: FinishId) {
  if (!finishId) return true;
  return !image.finishId || image.finishId === finishId;
}

export async function listGallery(
  modelId: ModelId,
  opts: { finishId?: FinishId; includeHidden?: boolean } = {},
): Promise<GalleryImage[]> {
  try {
    const snap = await galleryCol().where("modelId", "==", modelId).get();
    const docs = snap.docs
      .map((doc) => asImage(doc.id, doc.data()))
      .filter((item): item is GalleryImage => Boolean(item));
    const hiddenIds = new Set(docs.filter((item) => item.hidden).map((item) => item.id));
    const uploaded = docs
      .filter((item) => !item.system && !item.hidden && matchesFinish(item, opts.finishId))
      .sort(sortImages);
    const defaults = defaultGalleryImages(modelId, opts.finishId).map((item) => ({
      ...item,
      hidden: hiddenIds.has(item.id),
    }));
    const visibleDefaults = opts.includeHidden
      ? defaults
      : defaults.filter((item) => !item.hidden);
    return [...uploaded, ...visibleDefaults];
  } catch {
    return defaultGalleryImages(modelId, opts.finishId);
  }
}

export async function listAllGalleries(opts: { includeHidden?: boolean } = {}) {
  const entries = await Promise.all(
    (Object.keys(products) as ModelId[]).map(async (modelId) => ({
      modelId,
      images: await listGallery(modelId, opts),
    })),
  );
  return entries;
}

export async function addGalleryImage(input: {
  modelId: ModelId;
  finishId: FinishId;
  src?: string;
  buffer?: Buffer;
  mime?: string;
}): Promise<GalleryImage> {
  if (!isModelId(input.modelId)) {
    throw Object.assign(new Error("Anillo inválido."), { status: 400 });
  }
  if (!isProductFinish(input.modelId, input.finishId)) {
    throw Object.assign(new Error("Color inválido."), { status: 400 });
  }

  let buffer = input.buffer;
  let mime = input.mime || "image/jpeg";
  if (!buffer && input.src?.startsWith("data:image/")) {
    const parsed = parseDataUrl(input.src);
    buffer = parsed.buffer;
    mime = parsed.mime;
  }
  if (!buffer?.length) {
    throw Object.assign(new Error("Solo se aceptan imágenes."), { status: 400 });
  }
  if (buffer.length > 6_000_000) {
    throw Object.assign(new Error("La imagen pesa demasiado. Prueba una más ligera."), {
      status: 400,
    });
  }

  const current = await listGallery(input.modelId, {
    finishId: input.finishId,
    includeHidden: true,
  });
  const uploadedCount = current.filter((item) => !item.system).length;
  if (uploadedCount >= MAX_IMAGES) {
    throw Object.assign(new Error("Máximo 24 imágenes por color."), { status: 400 });
  }

  const now = Date.now();
  const image: GalleryImage = {
    id: randomUUID(),
    modelId: input.modelId,
    finishId: input.finishId,
    src: `/api/gallery/file/pending`,
    sort: uploadedCount,
    createdAt: now,
    mime,
  };

  const path = galleryObjectPath(input.modelId, input.finishId, image.id);
  try {
    await adminBucket()
      .file(path)
      .save(buffer, {
        contentType: mime.startsWith("image/") ? mime : "image/jpeg",
        resumable: false,
        metadata: { cacheControl: "public, max-age=31536000, immutable" },
      });
    image.src = `/api/gallery/file/${image.id}`;
    image.storagePath = path;
  } catch (error) {
    if (input.src && input.src.length <= MAX_DATA_URL_CHARS) {
      image.src = input.src;
    } else {
      throw Object.assign(
        new Error(
          error instanceof Error
            ? `No se pudo guardar la foto. ${error.message}`
            : "No se pudo guardar la foto.",
        ),
        { status: 500 },
      );
    }
  }

  const record: Record<string, unknown> = {
    id: image.id,
    modelId: image.modelId,
    finishId: image.finishId,
    src: image.src,
    sort: image.sort,
    createdAt: image.createdAt,
    mime: image.mime,
  };
  if (image.storagePath) record.storagePath = image.storagePath;
  await galleryCol().doc(image.id).set(record);
  return image;
}

export async function removeGalleryImage(id: string) {
  if (id.startsWith("default-")) {
    throw Object.assign(new Error("La foto de la casa no se borra. Ocúltala."), {
      status: 400,
    });
  }
  const ref = galleryCol().doc(id);
  const snap = await ref.get();
  const current = asImage(id, snap.data());
  if (!current) {
    throw Object.assign(new Error("Imagen no encontrada."), { status: 404 });
  }
  if (current.storagePath) {
    try {
      await adminBucket().file(current.storagePath).delete({ ignoreNotFound: true });
    } catch {
      /* ignore */
    }
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

  const siblings = (
    await listGallery(current.modelId, {
      finishId: current.finishId,
      includeHidden: true,
    })
  ).filter((item) => !item.system);
  const index = siblings.findIndex((item) => item.id === id);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  const swap = siblings[nextIndex];
  if (!swap) return siblings;

  const batch = adminDb().batch();
  batch.set(galleryCol().doc(current.id), { sort: swap.sort }, { merge: true });
  batch.set(galleryCol().doc(swap.id), { sort: current.sort }, { merge: true });
  await batch.commit();
  return listGallery(current.modelId, { includeHidden: true });
}

export async function setGalleryHidden(id: string, hidden: boolean) {
  if (!id.startsWith("default-")) {
    throw Object.assign(new Error("Solo se ocultan las fotos de la casa."), { status: 400 });
  }
  const modelId = id.startsWith("default-aero-")
    ? "aero"
    : id.startsWith("default-titan-")
      ? "titan"
      : null;
  if (!modelId) {
    throw Object.assign(new Error("Imagen inválida."), { status: 400 });
  }
  const base = defaultGalleryImages(modelId).find((item) => item.id === id);
  if (!base) {
    throw Object.assign(new Error("Imagen no encontrada."), { status: 404 });
  }
  if (hidden) {
    await galleryCol().doc(id).set({ ...base, hidden: true, system: true });
  } else {
    await galleryCol().doc(id).delete();
  }
}

export async function readGalleryFile(id: string): Promise<{
  buffer: Buffer;
  mime: string;
}> {
  const snap = await galleryCol().doc(id).get();
  const current = asImage(id, snap.data());
  if (!current || current.hidden) {
    throw Object.assign(new Error("Imagen no encontrada."), { status: 404 });
  }
  if (current.storagePath) {
    const [buffer] = await adminBucket().file(current.storagePath).download();
    return { buffer, mime: current.mime || "image/jpeg" };
  }
  if (current.src.startsWith("data:")) {
    const parsed = parseDataUrl(current.src);
    return { buffer: parsed.buffer, mime: parsed.mime };
  }
  throw Object.assign(new Error("Imagen no encontrada."), { status: 404 });
}

export { isModelId };
