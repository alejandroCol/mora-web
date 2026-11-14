import { COLLECTIONS, DOCS } from "@/commerce/paths";
import { channelOf, isInstagramConversationId } from "@/crm/channel";
import {
  DESK_LABEL,
  HUMAN_AGENT_WINDOW_MS,
  WINDOW_MS,
  conversationWindow,
  endOfDay,
  isCrmDesk,
} from "@/crm/labels";
import { LEGACY_PAYMENT_REPLY_BODIES, PAYMENT_REPLY_BODY, emptyCrmSettings } from "@/crm/replies";
import type {
  CrmCounts,
  CrmDesk,
  CrmLostReason,
  CrmNote,
  CrmQuickReply,
  CrmSeller,
  CrmSettings,
  CrmTemplate,
  ProductInterest,
  SupportStatus,
  SupportTopic,
  WhatsAppConversation,
  WhatsAppConversationStatus,
} from "@/growth/types";
import { listStaff } from "./adminAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { listAbandonedCarts } from "./abandonedCarts";
import { loadGrowthSettings } from "./growthSettings";
import { findLeadByInstagram, findLeadByPhone, upsertLead } from "./leads";
import { normalizePhone } from "./metaCapi";
import { recordChatQualified } from "./adsConversions";
import { listOrdersByPhone } from "./orders";
import {
  conversationIdFromPhone,
  getConversation,
  listConversations,
  sendWhatsAppTemplate,
  updateConversation,
} from "./whatsapp";

/**
 * Id de conversación a partir de lo que llega en la URL. WhatsApp usa el
 * teléfono (se normaliza); Instagram usa `ig_{persona}` y va tal cual.
 */
export function crmConversationId(raw: string) {
  return isInstagramConversationId(raw) ? raw : conversationIdFromPhone(raw) || raw;
}

function settingsDoc() {
  return adminDb().doc(DOCS.crm);
}

/**
 * Abre un chat de WhatsApp que empieza Mora (creadoras, alguien que pidió que
 * le escribieran). WhatsApp solo deja abrir con una plantilla aprobada; si la
 * persona responde, el chat sigue como cualquier otro.
 * Si ya existía un chat con ese número se reutiliza: no se pisa nombre ni mesa.
 */
export async function startCrmChat(
  input: { phone: string; name: string; templateId: string; desk: CrmDesk },
  staff: { uid: string; name: string },
) {
  const digits = input.phone.replace(/\D/g, "");
  const phone = conversationIdFromPhone(digits);
  if (digits.length < 10 || phone.length < 11 || phone.length > 15) {
    throw Object.assign(new Error("Revisa el número: celular de 10 dígitos o con indicativo de país."), {
      status: 400,
    });
  }
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!name) throw Object.assign(new Error("Escribe el nombre."), { status: 400 });

  const settings = await loadCrmSettings();
  const template = settings.templates.find((item) => item.id === input.templateId);
  if (!template) throw Object.assign(new Error("Elige una plantilla."), { status: 400 });

  const existing = await getConversation(phone);
  const first = name.split(" ")[0];
  // Las plantillas de Mora solo usan el nombre: toda variable se llena con él.
  const params = Array.from({ length: template.variables ?? 0 }, () => first);
  await sendWhatsAppTemplate({
    phone,
    name: template.name,
    language: template.language,
    params,
    preview: template.body,
    billingCategory: template.billingCategory ?? "marketing",
    by: staff.uid,
    byName: staff.name,
    claim: true,
  });

  if (!existing) {
    await updateConversation(phone, {
      name,
      desk: input.desk,
      status: "new",
      source: "organic",
    });
  } else if (!existing.name || existing.name === existing.phone) {
    await updateConversation(phone, { name });
  }
  await addCrmNote({
    phone,
    text: `${staff.name} abrió el chat con la plantilla «${template.label}».`,
    by: staff.uid,
    byName: staff.name,
    kind: "system",
  }).catch(() => undefined);

  return { id: phone, reused: Boolean(existing) };
}

/** `phone` es el id de la conversación: en WhatsApp coincide con el teléfono, en Instagram es `ig_…`. */
function notesCol(phone: string) {
  return adminDb().collection(COLLECTIONS.whatsappConversations).doc(phone).collection("notes");
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

export function crmCounts(
  conversations: WhatsAppConversation[],
  uid?: string,
): CrmCounts {
  const due = endOfDay();
  return {
    unread: conversations.filter((item) => item.unread > 0).length,
    unassigned: conversations.filter((item) => !item.assignedTo).length,
    followUpDue: conversations.filter(
      (item) => (item.nextFollowUpAt ?? 0) > 0 && (item.nextFollowUpAt ?? 0) <= due,
    ).length,
    supportOpen: conversations.filter(
      (item) =>
        (item.desk ?? "sales") === "support" && (item.supportStatus ?? "open") !== "resolved",
    ).length,
    mine: uid ? conversations.filter((item) => item.assignedTo === uid).length : 0,
    waitingOnUs: conversations.filter(
      (item) => (item.desk ?? "sales") === "sales" && item.lastDirection === "in" && (item.snoozedUntil ?? 0) <= Date.now(),
    ).length,
  };
}

export async function listCrmSellers(): Promise<CrmSeller[]> {
  const team = await listStaff();
  return team
    .filter((member) => member.active)
    .map((member) => ({
      uid: member.uid,
      name: member.name || member.email,
      role: member.role,
    }));
}

export async function loadCrmSettings(): Promise<CrmSettings> {
  const fallback = emptyCrmSettings();
  try {
    const snap = await settingsDoc().get();
    if (!snap.exists) return fallback;
    const data = snap.data() as Partial<CrmSettings>;
    const replies =
      Array.isArray(data.replies) && data.replies.length ? data.replies : fallback.replies;
    return {
      // El texto de «Pago» de fábrica cambió (Addi, link, web): si nadie lo editó, se refresca solo.
      replies: replies.map((item) =>
        item.id === "pago" && LEGACY_PAYMENT_REPLY_BODIES.includes(item.body)
          ? { ...item, body: PAYMENT_REPLY_BODY }
          : item,
      ),
      templates: Array.isArray(data.templates) ? data.templates : [],
      autoClaimOnReply: data.autoClaimOnReply !== false,
      updatedAt: Number(data.updatedAt ?? 0),
    };
  } catch (error) {
    console.error("[crm settings]", error);
    return fallback;
  }
}

export async function saveCrmSettings(patch: Partial<CrmSettings>): Promise<CrmSettings> {
  const current = await loadCrmSettings();
  const next: CrmSettings = {
    replies: sanitizeReplies(patch.replies ?? current.replies),
    templates: sanitizeTemplates(patch.templates ?? current.templates),
    autoClaimOnReply: patch.autoClaimOnReply ?? current.autoClaimOnReply,
    updatedAt: Date.now(),
  };
  await settingsDoc().set(next, { merge: true });
  return next;
}

function sanitizeReplies(replies: CrmQuickReply[]): CrmQuickReply[] {
  return replies
    .map((item) => ({
      id: String(item.id || crypto.randomUUID()),
      title: String(item.title ?? "").trim(),
      body: String(item.body ?? "").trim(),
      desk: (isCrmDesk(item.desk) ? item.desk : "both") as CrmQuickReply["desk"],
    }))
    .filter((item) => item.title && item.body)
    .slice(0, 40);
}

function sanitizeTemplates(templates: CrmTemplate[]): CrmTemplate[] {
  return templates
    .map((item) => ({
      id: String(item.id || crypto.randomUUID()),
      name: String(item.name ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_"),
      language: String(item.language ?? "es").trim() || "es",
      label: String(item.label ?? "").trim(),
      desk: (isCrmDesk(item.desk) ? item.desk : "both") as CrmTemplate["desk"],
      billingCategory: (
        item.billingCategory === "utility" || item.billingCategory === "authentication"
          ? item.billingCategory
          : "marketing"
      ) as CrmTemplate["billingCategory"],
      variables: Math.min(10, Math.max(0, Math.trunc(Number(item.variables) || 0))),
      body: String(item.body ?? "").trim().slice(0, 1024),
    }))
    .filter((item) => item.name && item.label)
    .slice(0, 20);
}

export async function listCrmNotes(phone: string, limit = 40): Promise<CrmNote[]> {
  const snap = await notesCol(phone).orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<CrmNote, "id">) }));
}

export async function addCrmNote(input: {
  phone: string;
  text: string;
  by: string;
  byName: string;
  kind?: CrmNote["kind"];
}): Promise<CrmNote> {
  const text = input.text.trim();
  if (!text) {
    throw Object.assign(new Error("Escribe una nota."), { status: 400 });
  }
  const ref = notesCol(input.phone).doc();
  const note: CrmNote = {
    id: ref.id,
    phone: input.phone,
    text,
    by: input.by,
    byName: input.byName,
    at: Date.now(),
    kind: input.kind ?? "note",
  };
  await ref.set(note);
  return note;
}

export type ConversationPatch = {
  status?: WhatsAppConversationStatus;
  unread?: number;
  assignedTo?: string | null;
  desk?: CrmDesk;
  interest?: ProductInterest;
  city?: string;
  email?: string;
  name?: string;
  /** Solo Instagram: el celular que dio la persona. Une el chat con sus pedidos y carritos. */
  phone?: string;
  nextFollowUpAt?: number | null;
  supportStatus?: SupportStatus;
  supportTopic?: SupportTopic;
  pinned?: boolean;
  snoozedUntil?: number | null;
  lostReason?: CrmLostReason | "";
};

export async function patchConversation(
  id: string,
  patch: ConversationPatch,
  actor?: { uid: string; name: string },
) {
  const current = await getConversation(id);
  if (!current) {
    throw Object.assign(new Error("Conversación no encontrada."), { status: 404 });
  }

  const next: Partial<WhatsAppConversation> = {};
  if (patch.status) next.status = patch.status;
  if (typeof patch.unread === "number") next.unread = Math.max(0, patch.unread);
  if (patch.desk) {
    if (!isCrmDesk(patch.desk)) throw Object.assign(new Error("Esa mesa no existe."), { status: 400 });
    next.desk = patch.desk;
    if (patch.desk === "support" && !current.supportStatus && !patch.supportStatus) {
      next.supportStatus = "open";
    }
  }
  if (patch.interest) next.interest = patch.interest;
  if (typeof patch.city === "string") next.city = patch.city.trim();
  if (typeof patch.email === "string") next.email = patch.email.trim().toLowerCase();
  if (typeof patch.name === "string" && patch.name.trim()) next.name = patch.name.trim();
  if (typeof patch.phone === "string" && channelOf(current) === "instagram") {
    const digits = patch.phone.replace(/\D/g, "");
    if (digits && digits.length < 10) {
      throw Object.assign(new Error("Ese celular está incompleto."), { status: 400 });
    }
    next.phone = digits ? normalizePhone(digits) : "";
  }
  if (patch.supportStatus) next.supportStatus = patch.supportStatus;
  if (patch.supportTopic) next.supportTopic = patch.supportTopic;
  if (typeof patch.pinned === "boolean") next.pinned = patch.pinned;
  if (patch.lostReason === "") next.lostReason = undefined;
  else if (patch.lostReason) next.lostReason = patch.lostReason;
  if (patch.snoozedUntil === null) {
    next.snoozedUntil = 0;
  } else if (typeof patch.snoozedUntil === "number") {
    next.snoozedUntil = patch.snoozedUntil;
    next.nextFollowUpAt = patch.snoozedUntil;
  }

  if (patch.nextFollowUpAt === null) {
    next.nextFollowUpAt = 0;
  } else if (typeof patch.nextFollowUpAt === "number") {
    next.nextFollowUpAt = patch.nextFollowUpAt;
  }

  if (patch.assignedTo === null || patch.assignedTo === "") {
    next.assignedTo = "";
    next.assignedName = "";
    next.assignedAt = 0;
  } else if (typeof patch.assignedTo === "string") {
    const sellers = await listCrmSellers();
    const seller = sellers.find((item) => item.uid === patch.assignedTo);
    next.assignedTo = patch.assignedTo;
    next.assignedName = seller?.name ?? actor?.name ?? "";
    next.assignedAt = Date.now();
  }

  const conversation = await updateConversation(id, compact(next));
  if (!conversation) return null;

  // Interesado o cotizado: si llegó por un anuncio de WhatsApp, Meta se entera de que el contacto sirve.
  if (patch.status === "interested" || patch.status === "quoted") {
    await recordChatQualified(id).catch(() => undefined);
  }

  if (conversation.desk !== "creators") {
    await upsertLead({
      source:
        conversation.source === "ad" ? "ad" : channelOf(conversation) === "instagram" ? "instagram" : "whatsapp",
      name: conversation.name,
      phone: conversation.phone,
      email: conversation.email,
      igUserId: conversation.igUserId,
      igUsername: conversation.igUsername,
      conversationId: conversation.id,
      lastEvent: "Contact",
      status:
        conversation.status === "sold"
          ? "sold"
          : conversation.status === "closed"
            ? "closed"
            : "interested",
      orderId: conversation.orderId,
      orderNumber: conversation.orderNumber,
      assignedTo: conversation.assignedTo,
      assignedName: conversation.assignedName,
    }).catch(() => undefined);
  }

  if (actor && (patch.assignedTo || patch.desk || patch.status || patch.supportStatus)) {
    const bits = [
      patch.desk ? `Mesa ${DESK_LABEL[patch.desk].toLowerCase()}` : "",
      patch.status ? `Estado ${patch.status}` : "",
      patch.supportStatus ? `Soporte ${patch.supportStatus}` : "",
      patch.assignedTo === "" || patch.assignedTo === null
        ? "Sin dueño"
        : patch.assignedTo
          ? `Dueño ${conversation.assignedName || "asignado"}`
          : "",
    ].filter(Boolean);
    if (bits.length) {
      await addCrmNote({
        phone: conversation.id,
        text: bits.join(" · "),
        by: actor.uid,
        byName: actor.name,
        kind: "system",
      }).catch(() => undefined);
    }
  }

  return conversation;
}

/**
 * Ficha del contacto. `id` es el id de la conversación. En Instagram la persona
 * no tiene teléfono hasta que lo da: mientras tanto no hay pedidos ni carritos que cruzar.
 */
export async function getCrmContact(id: string) {
  const conversation = await getConversation(id);
  const instagram = conversation ? channelOf(conversation) === "instagram" : isInstagramConversationId(id);
  const phone = instagram ? (conversation?.phone ?? "") : id;
  const [lead, orders, carts, notes, otherChat, settings] = await Promise.all([
    instagram
      ? findLeadByInstagram(conversation?.igUserId ?? "").then((found) => found ?? (phone ? findLeadByPhone(phone) : null))
      : findLeadByPhone(phone),
    phone ? listOrdersByPhone(phone) : Promise.resolve([]),
    phone ? listAbandonedCartsByPhone(phone) : Promise.resolve([]),
    conversation ? listCrmNotes(id) : Promise.resolve([]),
    phone ? findOtherChat(id, phone).catch(() => null) : Promise.resolve(null),
    instagram ? loadGrowthSettings() : Promise.resolve(null),
  ]);
  const lastInboundAt =
    conversation?.lastInboundAt ??
    (conversation?.lastDirection === "in" || !conversation?.lastOutboundAt
      ? conversation?.lastAt
      : undefined);
  const window = conversationWindow(
    lastInboundAt,
    settings?.instagramHumanAgent ? HUMAN_AGENT_WINDOW_MS : WINDOW_MS,
  );
  return {
    phone,
    conversation,
    lead,
    orders,
    carts,
    notes,
    /** La misma persona en el otro canal (mismo celular), para saltar de un chat al otro. */
    otherChat,
    windowOpen: window.open,
    windowClosesAt: window.closesAt,
  };
}

async function findOtherChat(id: string, phone: string) {
  const snap = await adminDb()
    .collection(COLLECTIONS.whatsappConversations)
    .where("phone", "==", phone)
    .limit(3)
    .get();
  const other = snap.docs.find((doc) => doc.id !== id);
  if (!other) return null;
  const data = other.data() as WhatsAppConversation;
  return { id: other.id, channel: channelOf({ id: other.id, channel: data.channel }) };
}

async function listAbandonedCartsByPhone(phone: string) {
  const carts = await listAbandonedCarts(80);
  const digits = phone.replace(/\D/g, "");
  return carts.filter((cart) => {
    const other = (cart.customer.phone ?? "").replace(/\D/g, "");
    if (!other) return false;
    return other === digits || other.endsWith(digits.slice(-10)) || digits.endsWith(other.slice(-10));
  });
}

export async function loadCrmWorkspace(uid?: string) {
  const [conversations, sellers, settings] = await Promise.all([
    listConversations(200),
    listCrmSellers(),
    loadCrmSettings(),
  ]);
  return {
    conversations,
    sellers,
    settings,
    counts: crmCounts(conversations, uid),
  };
}

