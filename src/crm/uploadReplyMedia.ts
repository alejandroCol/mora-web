import type { CrmQuickReplyMedia } from "@/growth/types";
import { looksLikeVideo, toJpeg } from "./jpeg";
import { OUTBOUND_MEDIA, outboundFileError } from "./media";

export type ReplyUploadProgress = { phase: "upload"; percent: number } | { phase: "convert" };

type Fetcher = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

/** Igual que `VIDEO_PART_BYTES` y `VIDEO_SOURCE_MAX_BYTES` del servidor. */
const PART_BYTES = 8 * 1024 * 1024;
const SOURCE_MAX_BYTES = 150 * 1024 * 1024;

async function readResult(res: Response) {
  const data = (await res.json().catch(() => ({ ok: false, error: "El servidor no respondió. Vuelve a intentarlo." }))) as {
    ok?: boolean;
    error?: string;
    media?: CrmQuickReplyMedia;
  };
  if (!data.ok) throw new Error(data.error ?? "No se pudo subir.");
  return data;
}

function uploadId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function uploadVideo(fetcher: Fetcher, file: File, onProgress: (p: ReplyUploadProgress) => void) {
  if (file.size > SOURCE_MAX_BYTES) throw new Error("El video pesa más de 150 MB. Recórtalo y vuelve a subirlo.");
  const id = uploadId();
  const parts = Math.max(1, Math.ceil(file.size / PART_BYTES));
  onProgress({ phase: "upload", percent: 0 });
  for (let part = 0; part < parts; part += 1) {
    const chunk = file.slice(part * PART_BYTES, (part + 1) * PART_BYTES);
    let attempt = 0;
    for (;;) {
      try {
        await readResult(
          await fetcher(`/api/admin/crm/replies/media/part?id=${id}&part=${part}`, {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: chunk,
          }),
        );
        break;
      } catch (error) {
        attempt += 1;
        if (attempt >= 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
    onProgress({ phase: "upload", percent: Math.round(((part + 1) / parts) * 100) });
  }
  onProgress({ phase: "convert" });
  const start = () =>
    fetcher("/api/admin/crm/replies/media/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, parts, name: file.name }),
    });
  try {
    const res = await start();
    if (res.status !== 202) return (await readResult(res)).media!;
  } catch {
    // iOS corta la conexión si Safari pasa a segundo plano; el servidor sigue y deja el resultado.
  }
  return waitForVideo(fetcher, id, start);
}

const POLL_MS = 3000;
const POLL_LIMIT_MS = 6 * 60 * 1000;

async function waitForVideo(fetcher: Fetcher, id: string, start: () => Promise<Response>) {
  const until = Date.now() + POLL_LIMIT_MS;
  let restarted = false;
  while (Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    let res: Response;
    try {
      res = await fetcher(`/api/admin/crm/replies/media/video?id=${id}`);
    } catch {
      continue;
    }
    if (res.status === 202) continue;
    if (res.status === 404 && !restarted) {
      // El POST nunca llegó: las partes siguen en el servidor, se pide de nuevo.
      restarted = true;
      start().catch(() => undefined);
      continue;
    }
    return (await readResult(res)).media!;
  }
  throw new Error("La conversión tardó demasiado. Vuelve a subir el video.");
}

/** Foto o video de una respuesta rápida. Los videos del iPhone (.mov) se convierten a MP4 en el servidor. */
export async function uploadReplyMedia(
  fetcher: Fetcher,
  file: File,
  onProgress: (p: ReplyUploadProgress) => void,
): Promise<CrmQuickReplyMedia> {
  if (looksLikeVideo(file)) {
    // Que el iPhone no bloquee la pantalla mientras sube y convierte.
    const lock = await navigator.wakeLock?.request("screen").catch(() => null);
    try {
      return await uploadVideo(fetcher, file, onProgress);
    } finally {
      await lock?.release().catch(() => undefined);
    }
  }
  if (!file.type.startsWith("image/") && !/\.(heic|heif|webp)$/i.test(file.name)) {
    throw new Error("Solo fotos o videos.");
  }
  let photo = file;
  if (!OUTBOUND_MEDIA.image.mime.includes(file.type) || file.size > OUTBOUND_MEDIA.image.maxBytes) {
    photo = await toJpeg(file, file.name);
  }
  const problem = outboundFileError(photo.type, photo.size);
  if (problem) throw new Error(problem);
  onProgress({ phase: "upload", percent: 0 });
  const form = new FormData();
  form.set("file", photo, photo.name);
  const media = (await readResult(await fetcher("/api/admin/crm/replies/media", { method: "POST", body: form }))).media!;
  onProgress({ phase: "upload", percent: 100 });
  return media;
}
