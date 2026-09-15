import { COLLECTIONS } from "@/commerce/paths";
import type {
  AttributionSnapshot,
  LeadSource,
  LeadStatus,
  MoraLead,
} from "@/growth/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { normalizePhone } from "./metaCapi";

function leads() {
  return adminDb().collection(COLLECTIONS.leads);
}

export async function upsertLead(input: {
  source: LeadSource;
  name?: string;
  email?: string;
  phone?: string;
  attribution?: AttributionSnapshot;
  lastEvent: string;
  conversationId?: string;
  orderId?: string;
  orderNumber?: string;
  status?: LeadStatus;
}): Promise<MoraLead | null> {
  const email = input.email?.trim().toLowerCase() ?? "";
  const phone = input.phone ? normalizePhone(input.phone) : "";
  if (!email && !phone) return null;

  const now = Date.now();
  const existing = await findLead({ email, phone });
  const next: MoraLead = {
    id: existing?.id ?? leads().doc().id,
    source: existing?.source ?? input.source,
    name: input.name?.trim() || existing?.name || "",
    email: email || existing?.email || "",
    phone: phone || existing?.phone || "",
    attribution: { ...(existing?.attribution ?? {}), ...(input.attribution ?? {}) },
    lastEvent: input.lastEvent,
    status: input.status ?? existing?.status ?? "new",
    conversationId: input.conversationId ?? existing?.conversationId,
    orderId: input.orderId ?? existing?.orderId,
    orderNumber: input.orderNumber ?? existing?.orderNumber,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing && existing.status === "sold" && next.status === "new") {
    next.status = "sold";
  }
  if (input.attribution?.utmSource === "facebook" || input.attribution?.fbclid) {
    if (next.source === "site" || next.source === "checkout") next.source = "ad";
  }

  await leads().doc(next.id).set(next, { merge: true });
  return next;
}

async function findLead(input: { email: string; phone: string }) {
  if (input.phone) {
    const snap = await leads().where("phone", "==", input.phone).limit(1).get();
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...(snap.docs[0].data() as Omit<MoraLead, "id">) };
    }
  }
  if (input.email) {
    const snap = await leads().where("email", "==", input.email).limit(1).get();
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...(snap.docs[0].data() as Omit<MoraLead, "id">) };
    }
  }
  return null;
}

export async function listLeads(limit = 80): Promise<MoraLead[]> {
  const snap = await leads().orderBy("updatedAt", "desc").limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<MoraLead, "id">) }));
}

export async function markLeadSold(input: {
  phone?: string;
  email?: string;
  orderId: string;
  orderNumber: string;
}) {
  const lead = await findLead({
    email: input.email?.trim().toLowerCase() ?? "",
    phone: input.phone ? normalizePhone(input.phone) : "",
  });
  if (!lead) return;
  await leads().doc(lead.id).set(
    {
      status: "sold",
      lastEvent: "Purchase",
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}
