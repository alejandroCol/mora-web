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

function conversationIdFromPhone(phone: string) {
  return normalizePhone(phone) || phone.replace(/\D/g, "");
}

export async function listConversations(limit = 80): Promise<WhatsAppConversation[]> {
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
  };
  await messages(to).doc(message.id).set(message, { merge: true });
  await conversations().doc(to).set(
    {
      id: to,
      phone: to,
      lastMessage: input.text,
      lastDirection: "out",
      lastAt: at,
      unread: 0,
    },
    { merge: true },
  );
  return message;
}

export async function updateConversation(
  id: string,
  patch: Partial<WhatsAppConversation>,
) {
  await conversations().doc(id).set({ ...patch, id }, { merge: true });
  return getConversation(id);
}

type WebhookMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
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

export async function ingestWhatsAppWebhook(payload: unknown) {
  const root = payload as {
    entry?: {
      changes?: {
        value?: {
          contacts?: WebhookContact[];
          messages?: WebhookMessage[];
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
      for (const raw of value?.messages ?? []) {
        if (!raw.from || !raw.id) continue;
        const phone = conversationIdFromPhone(raw.from);
        const contact = contacts.find((item) => item.wa_id === raw.from);
        const name = contact?.profile?.name ?? "";
        const text =
          raw.text?.body ??
          (raw.type && raw.type !== "text" ? `[${raw.type}]` : "");
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
        };
        await messages(phone).doc(raw.id).set(message, { merge: true });

        const source = referral || prev?.source === "ad" ? "ad" : prev?.source ?? "organic";
        const attribution: AttributionSnapshot = {
          ...(prev?.attribution ?? {}),
          ...(referral?.ctwaClid ? { fbclid: referral.ctwaClid } : {}),
          utmSource: referral ? "facebook" : prev?.attribution?.utmSource,
          utmMedium: referral ? "paid" : prev?.attribution?.utmMedium,
          utmCampaign: referral?.headline ?? prev?.attribution?.utmCampaign,
        };

        const unread = (prev?.unread ?? 0) + 1;
        await conversations().doc(phone).set(
          {
            id: phone,
            phone,
            name: name || prev?.name || phone,
            lastMessage: text,
            lastDirection: "in",
            lastAt: at,
            unread,
            status: prev?.status ?? "new",
            source,
            referral: referral ?? prev?.referral,
            attribution,
          },
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

export type { WhatsAppReferral };
