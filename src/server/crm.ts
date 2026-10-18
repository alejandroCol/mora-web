import { DOCS } from "@/commerce/paths";
import { conversationWindow, endOfDay } from "@/crm/labels";
import { emptyCrmSettings } from "@/crm/replies";
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
import { findLeadByPhone, upsertLead } from "./leads";
import { listOrdersByPhone } from "./orders";
import {
  getConversation,
  listConversations,
  updateConversation,
} from "./whatsapp";

function settingsDoc() {
  return adminDb().doc(DOCS.crm);
}

function notesCol(phone: string) {
  return adminDb().collection("whatsappConversations").doc(phone).collection("notes");
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
    return {
      replies: Array.isArray(data.replies) && data.replies.length ? data.replies : fallback.replies,
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
      desk: (item.desk === "sales" || item.desk === "support" ? item.desk : "both") as CrmQuickReply["desk"],
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
      desk: (item.desk === "sales" || item.desk === "support" ? item.desk : "both") as CrmTemplate["desk"],
      billingCategory: (
        item.billingCategory === "utility" || item.billingCategory === "authentication"
          ? item.billingCategory
          : "marketing"
      ) as CrmTemplate["billingCategory"],
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
    next.desk = patch.desk;
    if (patch.desk === "support" && !current.supportStatus && !patch.supportStatus) {
      next.supportStatus = "open";
    }
  }
  if (patch.interest) next.interest = patch.interest;
  if (typeof patch.city === "string") next.city = patch.city.trim();
  if (typeof patch.email === "string") next.email = patch.email.trim().toLowerCase();
  if (typeof patch.name === "string" && patch.name.trim()) next.name = patch.name.trim();
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

  await upsertLead({
    source: conversation.source === "ad" ? "ad" : "whatsapp",
    name: conversation.name,
    phone: conversation.phone,
    email: conversation.email,
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

  if (actor && (patch.assignedTo || patch.desk || patch.status || patch.supportStatus)) {
    const bits = [
      patch.desk ? `Mesa ${patch.desk === "support" ? "soporte" : "ventas"}` : "",
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
        phone: conversation.phone,
        text: bits.join(" · "),
        by: actor.uid,
        byName: actor.name,
        kind: "system",
      }).catch(() => undefined);
    }
  }

  return conversation;
}

export async function getCrmContact(phone: string) {
  const conversation = await getConversation(phone);
  const [lead, orders, carts, notes] = await Promise.all([
    findLeadByPhone(phone),
    listOrdersByPhone(phone),
    listAbandonedCartsByPhone(phone),
    conversation ? listCrmNotes(phone) : Promise.resolve([]),
  ]);
  const lastInboundAt =
    conversation?.lastInboundAt ??
    (conversation?.lastDirection === "in" || !conversation?.lastOutboundAt
      ? conversation?.lastAt
      : undefined);
  const window = conversationWindow(lastInboundAt);
  return {
    phone,
    conversation,
    lead,
    orders,
    carts,
    notes,
    windowOpen: window.open,
    windowClosesAt: window.closesAt,
  };
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

