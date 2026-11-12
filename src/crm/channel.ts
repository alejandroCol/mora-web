import type { CrmChannel } from "@/growth/types";

/**
 * El CRM nació con WhatsApp: cada conversación es `whatsappConversations/{teléfono}`.
 * Instagram vive en la misma colección con id `ig_{id de la persona en Instagram}`,
 * así tablero, notas, asignación y push sirven igual para los dos canales.
 */
const INSTAGRAM_PREFIX = "ig_";

export const CHANNEL_LABEL: Record<CrmChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

type ConversationHead = {
  id?: string;
  channel?: CrmChannel;
  name?: string;
  phone?: string;
  igUsername?: string;
};

export function instagramConversationId(igUserId: string) {
  return `${INSTAGRAM_PREFIX}${igUserId}`;
}

export function isInstagramConversationId(id: string) {
  return id.startsWith(INSTAGRAM_PREFIX);
}

/** Las conversaciones anteriores a Instagram no traen `channel`: son WhatsApp. */
export function channelOf(conversation: Pick<ConversationHead, "id" | "channel">): CrmChannel {
  if (conversation.channel) return conversation.channel;
  return conversation.id && isInstagramConversationId(conversation.id) ? "instagram" : "whatsapp";
}

/** Cómo se identifica a la persona: «@usuario» en Instagram, «+57…» en WhatsApp. */
export function conversationHandle(conversation: ConversationHead) {
  if (channelOf(conversation) === "instagram") {
    return conversation.igUsername ? `@${conversation.igUsername}` : "";
  }
  return conversation.phone ? `+${conversation.phone}` : "";
}

export function conversationTitle(conversation: ConversationHead) {
  return conversation.name?.trim() || conversationHandle(conversation) || "Sin nombre";
}

export function instagramProfileUrl(username: string) {
  return `https://www.instagram.com/${encodeURIComponent(username)}`;
}
