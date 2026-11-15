import { randomBytes } from "node:crypto";
import { DOCS } from "@/commerce/paths";
import { outboundFileError, outboundKindOf } from "@/crm/media";
import type { CrmQuickReply, CrmQuickReplyMedia } from "@/growth/types";
import { adminBucket, adminDb } from "@/lib/firebaseAdmin";
import { uploadWhatsAppMedia } from "./whatsapp";

/**
 * Foto o video de una respuesta rápida.
 * El original vive una sola vez en Storage. Para enviar se usa el id de Meta, que dura 30 días:
 * así mandar «Precio» con video no relee Storage ni vuelve a subir el archivo cada vez.
 */
const PREFIX = "crm/replies/";
/** Margen antes de los 30 días de Meta. */
const META_ID_TTL_MS = 25 * 24 * 60 * 60 * 1000;

export function isReplyMediaPath(path: string) {
  return path.startsWith(PREFIX) && /^crm\/replies\/[a-f0-9]{32}$/.test(path);
}

export async function storeReplyMedia(input: { bytes: Buffer; mimeType: string; name?: string }) {
  const kind = outboundKindOf(input.mimeType);
  const problem = outboundFileError(input.mimeType, input.bytes.byteLength);
  if (!kind || problem) throw Object.assign(new Error(problem), { status: 400 });
  const path = `${PREFIX}${randomBytes(16).toString("hex")}`;
  await adminBucket().file(path).save(input.bytes, { contentType: input.mimeType, resumable: false });
  const media: CrmQuickReplyMedia = { kind, path, mimeType: input.mimeType, name: input.name?.slice(0, 120) };
  // Ya que los bytes están en memoria, se suben a Meta de una vez: el primer envío sale sin leer Storage.
  try {
    media.waMediaId = await uploadWhatsAppMedia({ bytes: input.bytes, mimeType: input.mimeType, fileName: input.name });
    media.waUploadedAt = Date.now();
  } catch (error) {
    console.error("[crm reply media] se subirá a Meta al primer envío", error);
  }
  return media;
}

export async function readReplyMedia(path: string) {
  if (!isReplyMediaPath(path)) throw Object.assign(new Error("Archivo inválido."), { status: 400 });
  const file = adminBucket().file(path);
  const [[buffer], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return { buffer, mime: String(metadata.contentType || "application/octet-stream") };
}

export async function deleteReplyMedia(path: string) {
  if (!isReplyMediaPath(path)) return;
  await adminBucket().file(path).delete({ ignoreNotFound: true });
}

/** Id de Meta vigente para el adjunto; si caducó, se vuelve a subir desde Storage y se recuerda. */
export async function whatsappIdForReply(reply: CrmQuickReply, options: { force?: boolean } = {}) {
  const media = reply.media;
  if (!media) throw Object.assign(new Error("Esta respuesta no tiene adjunto."), { status: 400 });
  const now = Date.now();
  const fresh = media.waMediaId && now - (media.waUploadedAt ?? 0) < META_ID_TTL_MS;
  if (fresh && !options.force) return media.waMediaId!;
  const { buffer } = await readReplyMedia(media.path);
  const waMediaId = await uploadWhatsAppMedia({ bytes: buffer, mimeType: media.mimeType, fileName: media.name });
  await rememberMetaId(reply.id, media.path, waMediaId, now);
  return waMediaId;
}

async function rememberMetaId(replyId: string, path: string, waMediaId: string, at: number) {
  const ref = adminDb().doc(DOCS.crm);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const replies = (snap.data()?.replies ?? []) as CrmQuickReply[];
    // Si mientras tanto cambiaron el adjunto, no se pisa con un id viejo.
    const next = replies.map((item) =>
      item.id === replyId && item.media?.path === path
        ? { ...item, media: { ...item.media, waMediaId, waUploadedAt: at } }
        : item,
    );
    tx.set(ref, { replies: next }, { merge: true });
  });
}
