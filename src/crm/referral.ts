import type { WhatsAppConversation, WhatsAppReferral } from "@/growth/types";

/**
 * «Anuncio» para CTWA pagado, «Publicación» para post con botón «Enviar mensaje»,
 * «Comentario» para quien comentó en Instagram y recibió el DM automático.
 */
export function referralKindLabel(referral: WhatsAppReferral | undefined) {
  if (referral?.sourceType === "comment") return "Comentario";
  return referral?.sourceType === "post" ? "Publicación" : "Anuncio";
}

const SNIPPET_LENGTH = 30;

/** Primeros ~30 caracteres de un texto, cortando en palabra y con «…». */
export function snippet(text: string | undefined, max = SNIPPET_LENGTH) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : clean.slice(0, max)).trimEnd()}…`;
}

/**
 * Título corto para chips y badges. Prefiere el inicio del `body`: es el texto
 * del anuncio y distingue una promo de otra. El `headline` suele ser el CTA
 * genérico («Chatea con nosotros») y queda como respaldo.
 */
export function referralTitle(referral: WhatsAppReferral | undefined) {
  const body = snippet(referral?.body);
  if (body) return body;
  const headline = referral?.headline?.trim();
  if (headline) return headline;
  return referralKindLabel(referral);
}

/**
 * Imagen que mejor representa el creativo. Para video Meta manda `thumbnail_url`;
 * para imagen, `image_url`. Son URLs del CDN de Meta y pueden caducar: el
 * componente que las pinte debe tolerar el fallo.
 */
export function referralImage(referral: WhatsAppReferral | undefined) {
  if (!referral) return "";
  return referral.thumbnailUrl || referral.imageUrl || "";
}

/** Link seguro al anuncio o publicación (solo http/https). */
export function referralLink(referral: WhatsAppReferral | undefined) {
  const url = referral?.sourceUrl?.trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

/** Hay algo que mostrar: título, texto, imagen o link. */
export function hasReferral(referral: WhatsAppReferral | undefined): referral is WhatsAppReferral {
  if (!referral) return false;
  return Boolean(
    referral.headline || referral.body || referralImage(referral) || referralLink(referral) || referral.sourceId,
  );
}

/** El chat entró por un anuncio o publicación de Meta. */
export function cameFromAd(conversation: Pick<WhatsAppConversation, "source" | "referral">) {
  return conversation.source === "ad" || hasReferral(conversation.referral);
}
