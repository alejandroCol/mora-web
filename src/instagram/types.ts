/** Publicación elegida en una regla. Guardamos lo justo para reconocerla sin llamar a Meta. */
export type InstagramMediaRef = {
  id: string;
  permalink: string;
  caption: string;
};

/** Publicación reciente tal como la pinta el selector (la miniatura es un enlace de Meta que caduca). */
export type InstagramMediaItem = InstagramMediaRef & {
  thumbnail: string;
  kind: "image" | "video" | "album";
  at: number;
};

/**
 * Regla «comentan X → les escribo por DM».
 * Meta solo deja mandar UN mensaje por comentario, así que el DM lleva todo.
 */
export type InstagramAutomation = {
  id: string;
  name: string;
  active: boolean;
  /** "all": cualquier publicación. "media": solo las de `media`. */
  scope: "all" | "media";
  media: InstagramMediaRef[];
  /** "keywords": el comentario trae alguna palabra. "any": cualquier comentario. */
  trigger: "keywords" | "any";
  keywords: string[];
  /** Respuestas públicas al comentario; se elige una al azar. Vacío = no responde en público. */
  publicReplies: string[];
  dmText: string;
  /** Botón opcional con enlace. Si Meta no lo acepta, el enlace se manda dentro del texto. */
  dmButtonLabel: string;
  dmButtonUrl: string;
  /** Una persona recibe este DM una sola vez aunque comente varias veces. */
  oncePerPerson: boolean;
  sent: number;
  failed: number;
  lastSentAt: number;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
};

export type InstagramAutomationInput = Pick<
  InstagramAutomation,
  | "name"
  | "active"
  | "scope"
  | "media"
  | "trigger"
  | "keywords"
  | "publicReplies"
  | "dmText"
  | "dmButtonLabel"
  | "dmButtonUrl"
  | "oncePerPerson"
>;

export type InstagramEventStatus =
  /** Reservado: se está enviando ahora. */
  | "processing"
  | "sent"
  | "failed"
  /** Tope por hora alcanzado: se envía solo cuando haya cupo. */
  | "deferred"
  /** No se envió a propósito (ver `reason`). */
  | "skipped";

/** Un comentario que coincidió con una regla. El id es el del comentario: Meta puede repetir el aviso. */
export type InstagramCommentEvent = {
  id: string;
  mediaId: string;
  permalink?: string;
  fromId: string;
  username: string;
  text: string;
  at: number;
  status: InstagramEventStatus;
  reason?: "already_received";
  error?: string;
  automationId: string;
  automationName: string;
  dmText?: string;
  /** Id del DM en Meta y de la persona; sirven para enlazar el chat cuando responda. */
  messageId?: string;
  recipientId?: string;
  publicReply?: "sent" | "failed";
  attempts: number;
  updatedAt: number;
  sentAt?: number;
  /** Hora de envío `YYYYMMDDHH` (UTC): con esto se cuenta el tope por hora. */
  sentHour?: string;
};

export type InstagramConnectionStatus = {
  ready: boolean;
  username: string;
  pageName: string;
  connectedAt: number;
  humanAgent: boolean;
  /** Sin App secret no se puede comprobar que el aviso viene de Meta: se rechaza todo. */
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  webhook: string;
  debug: InstagramWebhookDebug;
  sentThisHour: number;
  hourlyCap: number;
};

export type InstagramWebhookDebug = {
  lastPostAt: number;
  lastComments: number;
  lastMessages: number;
  lastError: string;
  lastRejectedAt: number;
  lastRejectReason: string;
};

export const AUTOMATION_LIMITS = {
  name: 60,
  keywords: 20,
  keyword: 40,
  publicReplies: 3,
  publicReply: 300,
  /** Meta: 1000 caracteres por mensaje de texto. */
  dmText: 1000,
  /** Meta: 640 cuando el mensaje lleva botón. */
  dmTextWithButton: 640,
  buttonLabel: 20,
  media: 20,
} as const;

export function emptyAutomation(): InstagramAutomationInput {
  return {
    name: "",
    active: true,
    scope: "all",
    media: [],
    trigger: "keywords",
    keywords: [],
    publicReplies: [],
    dmText: "",
    dmButtonLabel: "",
    dmButtonUrl: "",
    oncePerPerson: true,
  };
}
