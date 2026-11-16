import { execFile } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { OUTBOUND_MEDIA } from "@/crm/media";
import { adminBucket } from "@/lib/firebaseAdmin";

/**
 * Videos de iPhone (.mov, HEVC, a menudo HDR) para respuestas rápidas.
 * Meta solo reproduce MP4 H.264 + AAC hasta 16 MB, y Cloud Run corta peticiones de más de 32 MB:
 * el navegador sube el original por partes a Storage y aquí se arma, se convierte y se borra.
 */
const UPLOADS = "crm/uploads/";
export const VIDEO_PART_BYTES = 8 * 1024 * 1024;
/** /tmp de Cloud Run vive en la memoria de la instancia (1 GB, compartida con ffmpeg). */
export const VIDEO_SOURCE_MAX_BYTES = 150 * 1024 * 1024;
/** Con 1 CPU en Cloud Run, 2 minutos de HEVC caben con holgura en los 300 s de la petición. */
const VIDEO_MAX_SECONDS = 120;
const MAX_PARTS = Math.ceil(VIDEO_SOURCE_MAX_BYTES / VIDEO_PART_BYTES);
const TARGET_BYTES = OUTBOUND_MEDIA.video.maxBytes - 1024 * 1024;
const AUDIO_KBPS = 96;

function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

export function isUploadId(id: string) {
  return /^[a-f0-9]{32}$/.test(id);
}

function partPath(id: string, part: number) {
  return `${UPLOADS}${id}/${String(part).padStart(3, "0")}`;
}

export async function storeVideoPart(id: string, part: number, bytes: Buffer) {
  if (!isUploadId(id)) fail("Subida inválida.");
  if (!Number.isInteger(part) || part < 0 || part >= MAX_PARTS) fail("El video pesa más de 150 MB.");
  if (bytes.byteLength === 0 || bytes.byteLength > VIDEO_PART_BYTES) fail("Parte inválida.");
  await adminBucket().file(partPath(id, part)).save(bytes, { resumable: false });
}

async function dropParts(id: string) {
  await adminBucket()
    .deleteFiles({ prefix: `${UPLOADS}${id}/`, force: true })
    .catch(() => undefined);
}

function run(args: string[], timeoutMs: number) {
  if (!ffmpegPath) fail("No se pudo convertir el video en el servidor.", 500);
  return new Promise<string>((resolve, reject) => {
    execFile(ffmpegPath!, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (error, _out, err) => {
      if (error) reject(Object.assign(error, { stderr: String(err) }));
      else resolve(String(err));
    });
  });
}

type Probe = { seconds: number; h264: boolean; aacOrSilent: boolean; hdr: boolean; hasAudio: boolean };

async function probe(file: string): Promise<Probe> {
  // Sin salida, ffmpeg termina con error pero ya imprimió los streams.
  const info = await run(["-hide_banner", "-i", file], 30_000).catch(
    (error: { stderr?: string }) => error.stderr ?? "",
  );
  const time = info.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!time || !/Stream #.*Video:/.test(info)) fail("No se pudo leer el video. Prueba con otro archivo.");
  const video = info.match(/Stream #.*Video: (\w+)[^\n]*/)?.[0] ?? "";
  const audio = info.match(/Stream #.*Audio: (\w+)/)?.[1];
  return {
    seconds: Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]),
    h264: /Video: h264/.test(video) && /yuv420p[,)\s]/.test(video),
    aacOrSilent: !audio || audio === "aac",
    hasAudio: Boolean(audio),
    hdr: /arib-std-b67|smpte2084|bt2020/.test(video),
  };
}

function encodeArgs(source: string, target: string, info: Probe) {
  const videoKbps = Math.max(
    350,
    Math.min(2500, Math.floor((TARGET_BYTES * 8) / 1000 / Math.max(info.seconds, 1)) - AUDIO_KBPS),
  );
  const fit = "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'";
  // HDR (HLG/Dolby Vision del iPhone) visto como SDR queda lavado: se pasa a BT.709 tras reducir tamaño.
  const filter = info.hdr
    ? `${fit},zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p`
    : `${fit},format=yuv420p`;
  return [
    "-hide_banner",
    "-y",
    "-i",
    source,
    "-map",
    "0:v:0",
    ...(info.hasAudio ? ["-map", "0:a:0"] : []),
    "-vf",
    filter,
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    info.seconds > 45 ? "superfast" : "veryfast",
    "-profile:v",
    "high",
    "-b:v",
    `${videoKbps}k`,
    "-maxrate",
    `${videoKbps}k`,
    "-bufsize",
    `${videoKbps * 2}k`,
    ...(info.hasAudio ? ["-c:a", "aac", "-b:a", `${AUDIO_KBPS}k`, "-ac", "2"] : []),
    "-map_metadata",
    "-1",
    "-movflags",
    "+faststart",
    target,
  ];
}

/** Arma las partes subidas y devuelve un MP4 que WhatsApp reproduce. */
export async function finishVideoUpload(id: string, parts: number): Promise<Buffer> {
  if (!isUploadId(id)) fail("Subida inválida.");
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS) fail("Subida incompleta.");
  const dir = await mkdtemp(join(tmpdir(), "crm-video-"));
  const source = join(dir, "source");
  const target = join(dir, "out.mp4");
  try {
    for (let part = 0; part < parts; part += 1) {
      const [bytes] = await adminBucket()
        .file(partPath(id, part))
        .download()
        .catch(() => fail("Se perdió una parte del video. Vuelve a subirlo."));
      await appendFile(source, bytes);
    }
    await dropParts(id);

    const info = await probe(source);
    if (info.seconds > VIDEO_MAX_SECONDS) fail("El video dura más de 2 minutos. Recórtalo y vuelve a subirlo.");
    const { size } = await stat(source);
    if (info.h264 && info.aacOrSilent && size <= OUTBOUND_MEDIA.video.maxBytes) {
      // Ya sirve: solo se reempaqueta como MP4, sin volver a codificar.
      await run(["-hide_banner", "-y", "-i", source, "-c", "copy", "-movflags", "+faststart", target], 60_000);
    } else {
      await run(encodeArgs(source, target, info), 240_000).catch((error: { killed?: boolean }) => {
        console.error("[crm video] ffmpeg", error);
        fail(
          error.killed
            ? "El video tardó demasiado en convertirse. Prueba con uno más corto."
            : "No se pudo convertir el video. Prueba con otro archivo.",
          error.killed ? 400 : 500,
        );
      });
    }
    const bytes = await readFile(target);
    if (bytes.byteLength > OUTBOUND_MEDIA.video.maxBytes) {
      fail("El video sigue pesando más de 16 MB. Recórtalo y vuelve a subirlo.");
    }
    return bytes;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    await dropParts(id);
  }
}
