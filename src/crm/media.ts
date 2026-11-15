/** Archivos que el CRM puede enviar por WhatsApp (topes de la Cloud API). */
export type OutboundMediaKind = "image" | "video";

export const OUTBOUND_MEDIA: Record<OutboundMediaKind, { mime: readonly string[]; maxBytes: number; label: string }> = {
  // webp va como sticker en Meta, no como foto.
  image: { mime: ["image/jpeg", "image/png"], maxBytes: 5 * 1024 * 1024, label: "JPG o PNG hasta 5 MB" },
  // Meta solo reproduce H.264 + AAC; un MP4 de iPhone o Android lo cumple.
  video: { mime: ["video/mp4", "video/3gpp"], maxBytes: 16 * 1024 * 1024, label: "MP4 hasta 16 MB" },
};

export const OUTBOUND_ACCEPT = [...OUTBOUND_MEDIA.image.mime, ...OUTBOUND_MEDIA.video.mime].join(",");

export function outboundKindOf(mime: string): OutboundMediaKind | null {
  if (OUTBOUND_MEDIA.image.mime.includes(mime)) return "image";
  if (OUTBOUND_MEDIA.video.mime.includes(mime)) return "video";
  return null;
}

/** Mensaje de error para el vendedor, o `""` si el archivo se puede enviar. */
export function outboundFileError(mime: string, size: number) {
  const kind = outboundKindOf(mime);
  if (!kind) return "Solo fotos JPG/PNG o videos MP4.";
  if (size > OUTBOUND_MEDIA[kind].maxBytes) {
    return kind === "video" ? "El video pesa más de 16 MB." : "La imagen pesa más de 5 MB.";
  }
  return "";
}

/** Pie de foto/video: WhatsApp corta en 1024 caracteres. */
export const WHATSAPP_CAPTION_MAX = 1024;
