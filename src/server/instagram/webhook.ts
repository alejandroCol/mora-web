import type { GrowthSettings } from "@/growth/types";
import { instagramReady } from "../growthSettings";
import { drainDeferredEvents, handleInstagramComment, type InstagramCommentChange } from "./automations";
import { connectionOf } from "./graph";
import { ingestInstagramMessaging, type InstagramMessagingEvent } from "./inbox";

/**
 * Reparte un aviso de Meta (ya con la firma comprobada):
 * comentarios → automatizaciones, mensajes → bandeja del CRM.
 */
type Payload = {
  object?: string;
  entry?: {
    id?: string;
    time?: number;
    changes?: { field?: string; value?: unknown }[];
    messaging?: InstagramMessagingEvent[];
  }[];
};

const COMMENT_FIELDS = new Set(["comments", "live_comments"]);
/** Según cómo esté configurada la app, Meta manda los mensajes en `messaging` o como `changes`. */
const MESSAGE_FIELDS = new Set(["messages", "messaging_postbacks", "message_reactions", "messaging_seen"]);
/** Comentarios en paralelo: en un post viral llegan por lotes y cada uno son 1-2 llamadas a Meta. */
const COMMENT_CONCURRENCY = 5;

function toMillis(seconds: number | undefined) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return Date.now();
  return value < 1e12 ? value * 1000 : value;
}

function reason(error: unknown) {
  return error instanceof Error ? error.message : "fallo desconocido";
}

export async function ingestInstagramWebhook(payload: unknown, settings: GrowthSettings) {
  const root = payload as Payload;
  const result = { comments: 0, messages: 0, errors: [] as string[] };
  if (root.object !== "instagram") return result;

  if (!instagramReady(settings)) {
    result.errors.push("Llegó un aviso pero Instagram no está conectado en Automatizaciones.");
    return result;
  }
  const connection = connectionOf(settings);

  const comments: { value: InstagramCommentChange; at: number }[] = [];
  for (const entry of root.entry ?? []) {
    const events = [...(entry.messaging ?? [])];
    for (const change of entry.changes ?? []) {
      if (!change.field || !change.value) continue;
      if (COMMENT_FIELDS.has(change.field)) {
        comments.push({ value: change.value as InstagramCommentChange, at: toMillis(entry.time) });
      } else if (MESSAGE_FIELDS.has(change.field)) {
        events.push(change.value as InstagramMessagingEvent);
      }
    }
    // Los mensajes van en orden: dos seguidos de la misma persona tocan la misma conversación.
    for (const event of events) {
      result.messages += 1;
      await ingestInstagramMessaging(event, { connection, businessId: entry.id ?? "" }).catch((error) =>
        result.errors.push(`mensaje: ${reason(error)}`),
      );
    }
  }

  result.comments = comments.length;
  for (let index = 0; index < comments.length; index += COMMENT_CONCURRENCY) {
    await Promise.all(
      comments.slice(index, index + COMMENT_CONCURRENCY).map(({ value, at }) =>
        handleInstagramComment(value, at, connection).catch((error) =>
          result.errors.push(`comentario: ${reason(error)}`),
        ),
      ),
    );
  }

  await drainDeferredEvents(connection).catch((error) => result.errors.push(`cola: ${reason(error)}`));
  return result;
}
