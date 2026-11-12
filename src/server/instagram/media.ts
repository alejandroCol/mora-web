import { createHash, randomBytes } from "node:crypto";
import { adminBucket } from "@/lib/firebaseAdmin";
import { siteOrigin } from "@/lib/site";

/**
 * Archivos de los chats de Instagram.
 * Entrantes: Meta da un enlace que caduca, así que se copian a Storage al recibirlos.
 * Salientes: Meta pide una URL pública de la imagen; se sirve desde `/api/instagram/file/{id}`
 * con un id aleatorio imposible de adivinar.
 */
const INBOUND_PREFIX = "crm/instagram/in/";
const OUTBOUND_PREFIX = "crm/instagram/out/";
const MAX_BYTES = 25 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;

/** Solo se descargan archivos de los dominios de Meta, aunque el aviso ya venga firmado. */
const META_HOSTS = ["fbcdn.net", "fbsbx.com", "cdninstagram.com", "facebook.com", "instagram.com"];

export function isMetaFileUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      META_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}

/** Copia un adjunto entrante. `null` si no se pudo: quien llama deja el enlace original. */
export async function storeInboundAttachment(input: {
  url: string;
  conversationId: string;
  messageId: string;
}): Promise<{ path: string; mimeType: string } | null> {
  if (!isMetaFileUrl(input.url)) return null;
  try {
    const res = await fetch(input.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null;
    const mimeType = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
    // El id de Meta trae caracteres que no sirven en una ruta: se usa su huella.
    const name = createHash("sha1").update(input.messageId).digest("hex");
    const path = `${INBOUND_PREFIX}${input.conversationId}/${name}`;
    await adminBucket().file(path).save(buffer, { contentType: mimeType, resumable: false });
    return { path, mimeType };
  } catch (error) {
    console.error("[instagram media] no se pudo copiar el adjunto", error);
    return null;
  }
}

function assertCrmPath(path: string) {
  const ok =
    (path.startsWith(INBOUND_PREFIX) || path.startsWith(OUTBOUND_PREFIX)) &&
    !path.includes("..") &&
    path.length < 300;
  if (!ok) throw Object.assign(new Error("Archivo inválido."), { status: 400 });
}

async function read(path: string) {
  const file = adminBucket().file(path);
  const [[buffer], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return { buffer, mime: String(metadata.contentType || "application/octet-stream") };
}

/** Archivo de un chat, para el equipo (la ruta que lo sirve exige sesión). */
export async function readCrmMedia(path: string) {
  assertCrmPath(path);
  return read(path);
}

export async function deleteCrmMedia(path: string) {
  assertCrmPath(path);
  await adminBucket().file(path).delete({ ignoreNotFound: true });
}

export async function storeOutboundImage(input: { bytes: Buffer; mimeType: string }) {
  const id = randomBytes(16).toString("hex");
  const path = `${OUTBOUND_PREFIX}${id}`;
  await adminBucket().file(path).save(input.bytes, { contentType: input.mimeType, resumable: false });
  return { path, url: `${siteOrigin()}/api/instagram/file/${id}` };
}

/** Imagen saliente por su id público (lo pide Meta para entregarla). */
export async function readOutboundImage(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw Object.assign(new Error("Archivo inválido."), { status: 400 });
  return read(`${OUTBOUND_PREFIX}${id}`);
}
