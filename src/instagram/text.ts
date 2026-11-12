/** Meta: un mensaje de texto de Instagram admite hasta 1000 caracteres. */
export const INSTAGRAM_TEXT_LIMIT = 1000;

/**
 * Parte un texto largo en varios mensajes sin cortar párrafos ni palabras
 * cuando se puede. Las respuestas rápidas del CRM nacieron para WhatsApp,
 * que admite más; así el vendedor no tiene que recortarlas a mano.
 */
export function splitForInstagram(text: string, limit = INSTAGRAM_TEXT_LIMIT): string[] {
  const clean = text.trim();
  if (clean.length <= limit) return clean ? [clean] : [];

  const chunks: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const paragraph of clean.split(/\n{2,}/)) {
    if (paragraph.length > limit) {
      push();
      let rest = paragraph;
      while (rest.length > limit) {
        const space = rest.lastIndexOf(" ", limit);
        const cut = space > limit * 0.6 ? space : limit;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      current = rest;
      continue;
    }
    if (current && current.length + 2 + paragraph.length > limit) push();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  push();
  return chunks;
}

/**
 * Celular colombiano escrito en un mensaje («mi número es 300 123 4567»).
 * Devuelve `57` + 10 dígitos, o "" si no hay uno claro.
 */
export function detectColombianMobile(text: string) {
  const match = text.match(/(?<!\d)(?:\+?57[\s.-]?)?(3\d{2})[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/);
  return match ? `57${match[1]}${match[2]}${match[3]}` : "";
}
