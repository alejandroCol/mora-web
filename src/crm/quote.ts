import type { WhatsAppMessage, WhatsAppQuote } from "@/growth/types";

const PLACEHOLDER_RE = /^\[(foto|audio|video|archivo|sticker|voice|document|image)\]$/i;
const QUOTE_MAX = 140;

/** Texto corto de un mensaje citado: «📷 Foto», «🎤 Nota de voz» o el texto recortado. */
export function quoteText(message: Pick<WhatsAppMessage, "type" | "text" | "mimeType">) {
  const mime = message.mimeType ?? "";
  const text = (message.text ?? "").replace(/\s+/g, " ").trim();
  const caption = PLACEHOLDER_RE.test(text) ? "" : text;
  const media = (label: string) => (caption ? `${label} · ${caption}` : label);
  if (message.type === "sticker") return "Sticker";
  if (message.type === "image" || mime.startsWith("image/")) return media("📷 Foto");
  if (message.type === "video" || mime.startsWith("video/")) return media("🎬 Video");
  if (message.type === "audio" || message.type === "voice" || mime.startsWith("audio/")) return "🎤 Nota de voz";
  if (message.type === "document") return `📎 ${caption || "Archivo"}`;
  if (message.type === "deleted") return "Mensaje eliminado";
  if (!caption) return "";
  return caption.length > QUOTE_MAX ? `${caption.slice(0, QUOTE_MAX).trimEnd()}…` : caption;
}

/** Copia del mensaje citado al momento de recibir la respuesta (el original puede no estar cargado). */
export function quoteOf(message: WhatsAppMessage | undefined): WhatsAppQuote {
  if (!message) return { text: "" };
  return { text: quoteText(message), direction: message.direction };
}
