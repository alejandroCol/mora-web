import type { WhatsAppConversation, WhatsAppReferral } from "@/growth/types";

/** «Anuncio» para CTWA pagado, «Publicación» para post con botón «Enviar mensaje». */
export function referralKindLabel(referral: WhatsAppReferral | undefined) {
  return referral?.sourceType === "post" ? "Publicación" : "Anuncio";
}

/** Título corto para chips y badges: headline, o el tipo si Meta no lo mandó. */
export function referralTitle(referral: WhatsAppReferral | undefined) {
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
