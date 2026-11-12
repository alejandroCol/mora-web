import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta firma cada webhook con el App secret: cabecera
 * `X-Hub-Signature-256: sha256=<HMAC del cuerpo tal como llegó>`.
 * Sin esta comprobación cualquiera que conozca la URL puede inventar mensajes.
 */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string) {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const received = Buffer.from(header.slice("sha256=".length), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Huella corta del secreto: permite saber si cambió sin guardarlo en otro sitio. */
export function secretFingerprint(appSecret: string) {
  return createHash("sha256").update(appSecret).digest("hex").slice(0, 12);
}
