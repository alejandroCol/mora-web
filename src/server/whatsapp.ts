import { COLLECTIONS } from "@/commerce/paths";
import type {
  AttributionSnapshot,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppReferral,
} from "@/growth/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadGrowthSettings } from "./growthSettings";
import { upsertLead } from "./leads";
import { normalizePhone, sendMetaEvent } from "./metaCapi";

const GRAPH = "https://graph.facebook.com/v21.0";

function conversations() {
  return adminDb().collection(COLLECTIONS.whatsappConversations);
}

function messages(conversationId: string) {
  return conversations().doc(conversationId).collection("messages");
}

export function conversationIdFromPhone(phone: string) {
  return normalizePhone(phone) || phone.replace(/\D/g, "");
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function inboundText(raw: WebhookMessage) {
  if (raw.text?.body) return raw.text.body;
  if (raw.button?.text) return raw.button.text;
  if (raw.interactive?.button_reply?.title) return raw.interactive.button_reply.title;
  if (raw.interactive?.list_reply?.title) return raw.interactive.list_reply.title;
  if (raw.image?.caption) return raw.image.caption;
  if (raw.document?.filename) return raw.document.filename;
  if (raw.type === "image") return "[foto]";
  if (raw.type === "audio" || raw.type === "voice") return "[audio]";
  if (raw.type === "video") return "[video]";
  if (raw.type === "document") return "[archivo]";
  if (raw.type === "sticker") return "[sticker]";
  if (raw.type && raw.type !== "text") return `[${raw.type}]`;
  return "";
}

function inboundMedia(raw: WebhookMessage) {
  const id =
    raw.image?.id ||
    raw.audio?.id ||
    raw.video?.id ||
    raw.document?.id ||
    raw.sticker?.id ||
    raw.voice?.id;
  const mime =
    raw.image?.mime_type ||
    raw.audio?.mime_type ||
    raw.video?.mime_type ||
    raw.document?.mime_type ||
    raw.sticker?.mime_type;
  return { mediaId: id, mimeType: mime };
}

export async function listConversations(limit = 200): Promise<WhatsAppConversation[]> {
  const snap = await conversations().orderBy("lastAt", "desc").limit(limit).get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<WhatsAppConversation, "id">),
  }));
}

export async function listMessages(conversationId: string, limit = 80) {
  const snap = await messages(conversationId).orderBy("at", "asc").limit(limit).get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<WhatsAppMessage, "id">),
  }));
}

export async function getConversation(id: string) {
  const snap = await conversations().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<WhatsAppConversation, "id">) };
}

export async function sendWhatsAppText(input: {
  phone: string;
  text: string;
  by?: string;
  byName?: string;
  claim?: boolean;
}) {
  const settings = await loadGrowthSettings();
  if (!settings.whatsappPhoneNumberId || !settings.whatsappAccessToken) {
    throw Object.assign(new Error("WhatsApp Business aún no está conectado."), {
      status: 503,
    });
  }

  const to = conversationIdFromPhone(input.phone);
  const res = await fetch(`${GRAPH}/${settings.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.whatsappAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: input.text },
    }),
  });
  const data = (await res.json()) as {
    messages?: { id: string }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw Object.assign(
      new Error(data.error?.message ?? "WhatsApp no aceptó el mensaje."),
      { status: 400 },
    );
  }

  const waId = data.messages?.[0]?.id;
  const at = Date.now();
  const message: WhatsAppMessage = {
    id: waId ?? messages(to).doc().id,
    waId,
    direction: "out",
    type: "text",
    text: input.text,
    at,
    status: "sent",
    billingCategory: "service",
    by: input.by,
  };
  await messages(to).doc(message.id).set(message, { merge: true });
  const existing = await getConversation(to);
  const claim =
    input.claim && input.by && input.by !== "auto" && !existing?.assignedTo
      ? { assignedTo: input.by, assignedName: input.byName ?? "", assignedAt: at }
      : {};
  await conversations().doc(to).set(
    compact({
      id: to,
      phone: to,
      lastMessage: input.text,
      lastDirection: "out",
      lastAt: at,
      lastOutboundAt: at,
      unread: 0,
      ...claim,
    }),
    { merge: true },
  );
  return message;
}

export async function sendWhatsAppTemplate(input: {
  phone: string;
  name: string;
  language: string;
  params?: string[];
  by?: string;
  byName?: string;
  claim?: boolean;
  billingCategory?: "marketing" | "utility" | "authentication";
}) {
  const settings = await loadGrowthSettings();
  if (!settings.whatsappPhoneNumberId || !settings.whatsappAccessToken) {
    throw Object.assign(new Error("WhatsApp Business aún no está conectado."), {
      status: 503,
    });
  }

  const to = conversationIdFromPhone(input.phone);
  const template: Record<string, unknown> = {
    name: input.name,
    language: { code: input.language || "es" },
  };
  if (input.params?.length) {
    template.components = [
      {
        type: "body",
        parameters: input.params.map((text) => ({ type: "text", text })),
      },
    ];
  }

  const res = await fetch(`${GRAPH}/${settings.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.whatsappAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template,
    }),
  });
  const data = (await res.json()) as {
    messages?: { id: string }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw Object.assign(
      new Error(data.error?.message ?? "WhatsApp no aceptó la plantilla."),
      { status: 400 },
    );
  }

  const waId = data.messages?.[0]?.id;
  const at = Date.now();
  const preview = `Plantilla ${input.name}`;
  const message: WhatsAppMessage = {
    id: waId ?? messages(to).doc().id,
    waId,
    direction: "out",
    type: "template",
    text: preview,
    at,
    status: "sent",
    templateName: input.name,
    billingCategory: input.billingCategory ?? "marketing",
    by: input.by,
  };
  await messages(to).doc(message.id).set(message, { merge: true });
  const existing = await getConversation(to);
  const claim =
    input.claim && input.by && !existing?.assignedTo
      ? { assignedTo: input.by, assignedName: input.byName ?? "", assignedAt: at }
      : {};
  await conversations().doc(to).set(
    compact({
      id: to,
      phone: to,
      lastMessage: preview,
      lastDirection: "out",
      lastAt: at,
      lastOutboundAt: at,
      unread: 0,
      ...claim,
    }),
    { merge: true },
  );
  return message;
}

export async function fetchWhatsAppMedia(mediaId: string) {
  const settings = await loadGrowthSettings();
  if (!settings.whatsappAccessToken) {
    throw Object.assign(new Error("WhatsApp Business aún no está conectado."), {
      status: 503,
    });
  }
  const meta = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${settings.whatsappAccessToken}` },
  });
  const info = (await meta.json()) as { url?: string; mime_type?: string; error?: { message?: string } };
  if (!meta.ok || !info.url) {
    throw Object.assign(new Error(info.error?.message ?? "No se pudo abrir el archivo."), {
      status: 400,
    });
  }
  const file = await fetch(info.url, {
    headers: { Authorization: `Bearer ${settings.whatsappAccessToken}` },
  });
  if (!file.ok) {
    throw Object.assign(new Error("WhatsApp no entregó el archivo."), { status: 400 });
  }
  return {
    contentType: info.mime_type || file.headers.get("content-type") || "application/octet-stream",
    body: Buffer.from(await file.arrayBuffer()),
  };
}

export async function updateConversation(
  id: string,
  patch: Partial<WhatsAppConversation>,
) {
  await conversations().doc(id).set(compact({ ...patch, id }), { merge: true });
  return getConversation(id);
}

type MediaBlob = { id?: string; caption?: string; mime_type?: string; filename?: string };

type WebhookMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
  image?: MediaBlob;
  audio?: MediaBlob;
  video?: MediaBlob;
  document?: MediaBlob;
  sticker?: MediaBlob;
  voice?: MediaBlob;
  referral?: {
    source_url?: string;
    source_id?: string;
    source_type?: string;
    headline?: string;
    body?: string;
    ctwa_clid?: string;
  };
};

type WebhookContact = {
  profile?: { name?: string };
  wa_id?: string;
};

type WebhookStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
};

export async function ingestWhatsAppWebhook(payload: unknown) {
  const root = payload as {
    entry?: {
      changes?: {
        value?: {
          contacts?: WebhookContact[];
          messages?: WebhookMessage[];
          statuses?: WebhookStatus[];
        };
      }[];
    }[];
  };

  const settings = await loadGrowthSettings();
  const seen: string[] = [];

  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contacts = value?.contacts ?? [];
      for (const status of value?.statuses ?? []) {
        if (!status.id || !status.recipient_id) continue;
        const phone = conversationIdFromPhone(status.recipient_id);
        await messages(phone).doc(status.id).set(
          compact({ status: status.status, waId: status.id }),
          { merge: true },
        );
      }
      for (const raw of value?.messages ?? []) {
        if (!raw.from || !raw.id) continue;
        const phone = conversationIdFromPhone(raw.from);
        const contact = contacts.find((item) => item.wa_id === raw.from);
        const name = contact?.profile?.name ?? "";
        const text = inboundText(raw);
        const media = inboundMedia(raw);
        const at = raw.timestamp ? Number(raw.timestamp) * 1000 : Date.now();
        const referral = raw.referral
          ? {
              sourceUrl: raw.referral.source_url,
              sourceId: raw.referral.source_id,
              sourceType: raw.referral.source_type,
              headline: raw.referral.headline,
              body: raw.referral.body,
              ctwaClid: raw.referral.ctwa_clid,
            }
          : undefined;

        const existing = await conversations().doc(phone).get();
        const isFirst = !existing.exists;
        const prev = existing.data() as WhatsAppConversation | undefined;

        const message: WhatsAppMessage = {
          id: raw.id,
          waId: raw.id,
          direction: "in",
          type: raw.type ?? "text",
          text,
          at,
          status: "received",
          mediaId: media.mediaId,
          mimeType: media.mimeType,
        };
        await messages(phone).doc(raw.id).set(compact(message), { merge: true });

        const source = referral || prev?.source === "ad" ? "ad" : prev?.source ?? "organic";
        const attribution: AttributionSnapshot = {
          ...(prev?.attribution ?? {}),
          ...(referral?.ctwaClid ? { fbclid: referral.ctwaClid } : {}),
          utmSource: referral ? "facebook" : prev?.attribution?.utmSource,
          utmMedium: referral ? "paid" : prev?.attribution?.utmMedium,
          utmCampaign: referral?.headline ?? prev?.attribution?.utmCampaign,
        };

        const unread = (prev?.unread ?? 0) + 1;
        const desk = prev?.desk ?? "sales";
        const sold = prev?.status === "sold";
        const closed = prev?.status === "closed" && !sold;
        const supportReopen =
          desk === "support" && (prev?.supportStatus ?? "open") === "resolved"
            ? { supportStatus: "open" as const }
            : {};
        await conversations().doc(phone).set(
          compact({
            id: phone,
            phone,
            name: name || prev?.name || phone,
            lastMessage: text,
            lastDirection: "in",
            lastAt: at,
            lastInboundAt: at,
            snoozedUntil: 0,
            unread,
            status: closed ? "interested" : (prev?.status ?? "new"),
            desk,
            source,
            referral: referral ?? prev?.referral,
            attribution,
            ...supportReopen,
          }),
          { merge: true },
        );

        const lead = await upsertLead({
          source: source === "ad" ? "ad" : "whatsapp",
          name: name || prev?.name,
          phone,
          attribution,
          lastEvent: referral ? "Lead" : "Contact",
          conversationId: phone,
          status: "interested",
        });
        if (lead) {
          await conversations().doc(phone).set({ leadId: lead.id }, { merge: true });
        }

        await sendMetaEvent({
          name: referral || isFirst ? "Lead" : "Contact",
          eventId: raw.id,
          actionSource: "business_messaging",
          sourceUrl: referral?.sourceUrl,
          user: { phone, firstName: name },
          attribution,
          data: {
            content_name: referral?.headline || "WhatsApp",
            content_category: "whatsapp",
          },
        }).catch(() => undefined);

        if (isFirst && settings.whatsappWelcome.trim()) {
          await sendWhatsAppText({
            phone,
            text: settings.whatsappWelcome,
            by: "auto",
          }).catch(() => undefined);
        }

        seen.push(phone);
      }
    }
  }

  return seen;
}

export function webhookUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/whatsapp/webhook`;
}

export async function setWhatsAppTwoStepPin(pin: string) {
  const digits = pin.replace(/\D/g, "");
  if (!/^\d{6}$/.test(digits)) {
    throw Object.assign(new Error("El PIN debe ser de 6 números."), { status: 400 });
  }
  const settings = await loadGrowthSettings();
  if (!settings.whatsappPhoneNumberId || !settings.whatsappAccessToken) {
    throw Object.assign(new Error("WhatsApp Business aún no está conectado."), {
      status: 503,
    });
  }

  const headers = {
    Authorization: `Bearer ${settings.whatsappAccessToken}`,
    "Content-Type": "application/json",
  };
  const id = settings.whatsappPhoneNumberId;
  const pinBody = JSON.stringify({ pin: digits });

  const setPin = await fetch(`${GRAPH}/${id}`, {
    method: "POST",
    headers,
    body: pinBody,
  });
  const setData = (await setPin.json()) as { success?: boolean; error?: { message?: string } };
  if (!setPin.ok) {
    throw Object.assign(new Error(setData.error?.message ?? "WhatsApp no aceptó el PIN."), {
      status: 400,
    });
  }

  const register = await fetch(`${GRAPH}/${id}/register`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messaging_product: "whatsapp", pin: digits }),
  });
  const registerData = (await register.json()) as { success?: boolean; error?: { message?: string } };
  if (!register.ok) {
    throw Object.assign(
      new Error(registerData.error?.message ?? "WhatsApp no registró el número con ese PIN."),
      { status: 400 },
    );
  }

  await adminDb().doc("settings/whatsappSecurity").set(
    { twoStepSetAt: Date.now(), method: "pin+register", isPinEnabled: true },
    { merge: true },
  );
  return { ok: true as const };
}

export async function loadWhatsAppSecurity() {
  const snap = await adminDb().doc("settings/whatsappSecurity").get();
  const data = snap.data() as { twoStepSetAt?: number } | undefined;
  return {
    twoStep: Boolean(data?.twoStepSetAt),
    twoStepSetAt: Number(data?.twoStepSetAt ?? 0),
  };
}

export type { WhatsAppReferral };
