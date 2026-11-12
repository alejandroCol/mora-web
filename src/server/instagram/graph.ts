import { BRAND } from "@/brand";
import type { GrowthSettings } from "@/growth/types";
import { INSTAGRAM_WEBHOOK_FIELDS, type InstagramMediaItem } from "@/instagram/types";
import { instagramReady } from "../growthSettings";

/**
 * Cliente de la API de Instagram (ruta «Facebook Login»: cuenta profesional
 * ligada a una Página, token de Página, host graph.facebook.com).
 * Todo lo que habla con Meta para Instagram pasa por aquí.
 */
const GRAPH = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 12_000;

/** Códigos de Meta que significan «ahora no, intenta luego» (límites y fallos temporales). */
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);

export class InstagramApiError extends Error {
  /** Estado para la respuesta de nuestro admin (no el de Meta: un 401 suyo no es un 401 nuestro). */
  readonly status = 400;
  readonly code?: number;
  readonly transient: boolean;

  constructor(message: string, detail: { httpStatus: number; code?: number }) {
    super(message);
    this.name = "InstagramApiError";
    this.code = detail.code;
    this.transient =
      detail.httpStatus >= 500 || (detail.code !== undefined && TRANSIENT_CODES.has(detail.code));
  }
}

/** Lo mínimo para llamar a Meta en nombre de la cuenta conectada. */
export type InstagramConnection = {
  pageId: string;
  accountId: string;
  username: string;
  token: string;
};

export function connectionOf(settings: GrowthSettings): InstagramConnection {
  if (!instagramReady(settings)) {
    throw Object.assign(new Error("Instagram aún no está conectado."), { status: 503 });
  }
  return {
    pageId: settings.instagramPageId,
    accountId: settings.instagramAccountId,
    username: settings.instagramUsername,
    token: settings.instagramAccessToken,
  };
}

type GraphErrorBody = {
  error?: { message?: string; code?: number; error_user_msg?: string };
};

async function call<T>(
  path: string,
  options: {
    token: string;
    method?: "GET" | "POST";
    query?: Record<string, string>;
    body?: unknown;
    /** El token de app (`id|secreto`) va como parámetro, que es la forma que documenta Meta. */
    tokenInQuery?: boolean;
  },
): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
  if (options.tokenInQuery) url.searchParams.set("access_token", options.token);

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        ...(options.tokenInQuery ? {} : { Authorization: `Bearer ${options.token}` }),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new InstagramApiError("Meta no respondió a tiempo.", { httpStatus: 504 });
  }

  const data = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!res.ok || data.error) {
    throw new InstagramApiError(
      data.error?.error_user_msg || data.error?.message || "Meta rechazó la solicitud.",
      { httpStatus: res.ok ? 400 : res.status, code: data.error?.code },
    );
  }
  return data;
}

// ---------------------------------------------------------------------------
// Conexión
// ---------------------------------------------------------------------------

export type InstagramLink = {
  pageId: string;
  pageName: string;
  pageToken: string;
  accountId: string;
  username: string;
};

type PageNode = {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id?: string; username?: string };
};

const PAGE_FIELDS = "id,name,access_token,instagram_business_account{id,username}";

/**
 * A partir de un token encuentra la Página y la cuenta de Instagram ligada.
 * Sirve el token del usuario del sistema (ve varias Páginas) o uno de Página.
 */
export async function discoverInstagramAccount(token: string): Promise<InstagramLink> {
  let pages: PageNode[] = [];
  try {
    const list = await call<{ data?: PageNode[] }>("me/accounts", {
      token,
      query: { fields: PAGE_FIELDS, limit: "100" },
    });
    pages = list.data ?? [];
  } catch (error) {
    // Un token de Página no tiene `/me/accounts`: ese mismo nodo es la Página.
    const self = await call<PageNode>("me", { token, query: { fields: PAGE_FIELDS } }).catch(() => {
      throw error;
    });
    pages = [{ ...self, access_token: self.access_token || token }];
  }

  const linked = pages.filter((page) => page.id && page.instagram_business_account?.id);
  if (linked.length === 0) {
    throw Object.assign(
      new Error(
        "Ese token no ve ninguna Página con Instagram profesional ligado. Dale al usuario del sistema acceso a la Página y a la cuenta de Instagram, y genera el token de nuevo.",
      ),
      { status: 400 },
    );
  }
  const page =
    linked.find(
      (item) =>
        item.instagram_business_account?.username?.toLowerCase() === BRAND.contact.instagramHandle,
    ) ?? linked[0];
  if (!page.access_token) {
    throw Object.assign(
      new Error("El token no tiene permiso para actuar como la Página. Revisa los permisos de páginas al generarlo."),
      { status: 400 },
    );
  }
  return {
    pageId: page.id!,
    pageName: page.name ?? "",
    pageToken: page.access_token,
    accountId: page.instagram_business_account!.id!,
    username: page.instagram_business_account!.username ?? "",
  };
}

/**
 * Suscripciones de la Página, de la más completa a la mínima. Los nombres son
 * los de Página (aquí «visto» es `message_reads`, no `messaging_seen`).
 * Con solo `feed` llegan los comentarios pero NO los mensajes directos:
 * para esos la Página tiene que estar suscrita a `messages`.
 */
const PAGE_SUBSCRIPTIONS = [
  ["feed", "messages", "messaging_postbacks", "message_reactions", "message_reads", "message_echoes"],
  ["feed", "messages", "messaging_postbacks"],
  ["feed", "messages"],
  ["messages"],
  ["feed"],
] as const;

/**
 * Meta solo manda avisos de Instagram si la app está suscrita a la Página.
 * Devuelve los campos que quedaron; cada intento reemplaza al anterior.
 */
export async function subscribePageToApp(link: Pick<InstagramLink, "pageId" | "pageToken">) {
  let lastError = "";
  for (const fields of PAGE_SUBSCRIPTIONS) {
    try {
      await call(`${link.pageId}/subscribed_apps`, {
        token: link.pageToken,
        method: "POST",
        query: { subscribed_fields: fields.join(",") },
      });
      return { ok: true as const, error: "", fields: [...fields] as string[] };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Meta no aceptó la suscripción.";
    }
  }
  return { ok: false as const, error: lastError, fields: [] as string[] };
}

/** La app de Meta a la que pertenece un token. */
export async function fetchTokenAppId(token: string) {
  const data = await call<{ id?: string }>("app", { token, query: { fields: "id" } });
  if (!data.id) {
    throw new InstagramApiError("Meta no dijo a qué app pertenece el token.", { httpStatus: 400 });
  }
  return data.id;
}

type AppSubscription = {
  object?: string;
  callback_url?: string;
  fields?: { name?: string }[];
};

/**
 * Registra en la app de Meta el webhook del objeto Instagram: lo mismo que
 * hace el panel de desarrolladores, pero sin depender de dónde lo esconda.
 * Meta llama a `callbackUrl` con `verifyToken` antes de aceptar.
 * Devuelve los campos que quedaron suscritos.
 */
export async function registerInstagramAppWebhook(input: {
  appId: string;
  appSecret: string;
  callbackUrl: string;
  verifyToken: string;
}): Promise<string[]> {
  const path = `${input.appId}/subscriptions`;
  const token = `${input.appId}|${input.appSecret}`;
  const subscribe = (fields: readonly string[]) =>
    call(path, {
      token,
      tokenInQuery: true,
      method: "POST",
      query: {
        object: "instagram",
        callback_url: input.callbackUrl,
        verify_token: input.verifyToken,
        fields: fields.join(","),
        include_values: "true",
      },
    });

  let sent: string[] = [...INSTAGRAM_WEBHOOK_FIELDS];
  try {
    await subscribe(sent);
  } catch (error) {
    // 100 = parámetro inválido. Si es por un campo que esta app no ofrece, se suscriben los demás.
    if (!(error instanceof InstagramApiError) || error.code !== 100) throw error;
    const accepted: string[] = [];
    for (const field of INSTAGRAM_WEBHOOK_FIELDS) {
      const ok = await subscribe([field]).then(
        () => true,
        () => false,
      );
      if (ok) accepted.push(field);
    }
    if (accepted.length === 0) throw error;
    await subscribe(accepted);
    sent = accepted;
  }

  // Lo que cuenta es lo que Meta dice que quedó, no lo que se le pidió.
  const current = await call<{ data?: AppSubscription[] }>(path, { token, tokenInQuery: true }).catch(
    () => null,
  );
  const node = current?.data?.find((item) => item.object === "instagram");
  const names = (node?.fields ?? []).map((field) => field.name ?? "").filter(Boolean);
  return names.length > 0 ? names : sent;
}

// ---------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------

/** A una persona (chat abierto) o como respuesta privada a su comentario (un solo mensaje). */
export type InstagramRecipient = { id: string } | { comment_id: string };

export type InstagramOutbound =
  | { text: string }
  | {
      attachment:
        | { type: "image"; payload: { url: string } }
        | {
            type: "template";
            payload: {
              template_type: "button";
              text: string;
              buttons: { type: "web_url"; url: string; title: string }[];
            };
          };
    };

export function buttonMessage(text: string, label: string, url: string): InstagramOutbound {
  return {
    attachment: {
      type: "template",
      payload: { template_type: "button", text, buttons: [{ type: "web_url", url, title: label }] },
    },
  };
}

export function imageMessage(url: string): InstagramOutbound {
  return { attachment: { type: "image", payload: { url } } };
}

export async function sendInstagramMessage(
  connection: InstagramConnection,
  recipient: InstagramRecipient,
  message: InstagramOutbound,
  options: { humanAgent?: boolean } = {},
) {
  const data = await call<{ recipient_id?: string; message_id?: string }>(
    `${connection.pageId}/messages`,
    {
      token: connection.token,
      method: "POST",
      body: {
        recipient,
        message,
        // Fuera de las 24 h Meta solo acepta respuestas de una persona del equipo, con esta etiqueta.
        ...(options.humanAgent ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" } : {}),
      },
    },
  );
  return { recipientId: data.recipient_id ?? "", messageId: data.message_id ?? "" };
}

/** Respuesta pública debajo del comentario. */
export async function replyToInstagramComment(
  connection: InstagramConnection,
  commentId: string,
  message: string,
) {
  const data = await call<{ id?: string }>(`${commentId}/replies`, {
    token: connection.token,
    method: "POST",
    body: { message },
  });
  return data.id ?? "";
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

/** Nombre y usuario de quien nos escribió. Meta solo lo da si la persona ya nos habló. */
export async function fetchInstagramProfile(connection: InstagramConnection, igUserId: string) {
  const data = await call<{ name?: string; username?: string }>(igUserId, {
    token: connection.token,
    query: { fields: "name,username" },
  });
  return { name: data.name?.trim() ?? "", username: data.username?.trim() ?? "" };
}

type MediaNode = {
  id?: string;
  caption?: string;
  media_type?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp?: string;
};

export async function listInstagramMedia(
  connection: InstagramConnection,
  limit = 24,
): Promise<InstagramMediaItem[]> {
  const data = await call<{ data?: MediaNode[] }>(`${connection.accountId}/media`, {
    token: connection.token,
    query: {
      fields: "id,caption,media_type,permalink,thumbnail_url,media_url,timestamp",
      limit: String(limit),
    },
  });
  return (data.data ?? [])
    .filter((item): item is MediaNode & { id: string } => Boolean(item.id))
    .map((item) => ({
      id: item.id,
      permalink: item.permalink ?? "",
      caption: (item.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
      // En video `media_url` es el archivo; la imagen está en `thumbnail_url`.
      thumbnail: item.thumbnail_url || (item.media_type === "VIDEO" ? "" : (item.media_url ?? "")),
      kind: item.media_type === "VIDEO" ? "video" : item.media_type === "CAROUSEL_ALBUM" ? "album" : "image",
      at: item.timestamp ? Date.parse(item.timestamp) || 0 : 0,
    }));
}

export async function fetchInstagramPermalink(connection: InstagramConnection, mediaId: string) {
  const data = await call<{ permalink?: string }>(mediaId, {
    token: connection.token,
    query: { fields: "permalink" },
  });
  return data.permalink ?? "";
}
