import { OUTBOUND_MEDIA } from "@/crm/media";

/** Lado mayor del JPG que sale por WhatsApp: se ve nítido en el chat y pesa poco. */
const MAX_SIDE = 1600;

/**
 * Foto que Meta no acepta tal cual (WebP de la tienda, HEIC del iPhone, JPG de más de 5 MB) → JPG.
 * Solo en el navegador; HEIC lo decodifica Safari, no Chrome.
 */
export async function toJpeg(source: Blob, name: string): Promise<File> {
  const bitmap = await createImageBitmap(source).catch(() => {
    throw new Error("No se pudo leer esta foto. Guárdala como JPG y vuelve a subirla.");
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la foto.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.88, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= OUTBOUND_MEDIA.image.maxBytes) {
      return new File([blob], `${name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
    }
  }
  throw new Error("La foto pesa demasiado.");
}

export function looksLikeVideo(file: File) {
  return file.type.startsWith("video/") || /\.(mov|mp4|m4v|3gp|hevc|qt)$/i.test(file.name);
}
