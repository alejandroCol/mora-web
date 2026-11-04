import { COLLECTIONS } from "@/commerce/paths";
import { SUPPORT_TOPICS } from "@/lib/supportTopics";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendSupportAckEmail, sendSupportStaffEmail } from "./email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hits = new Map<string, number[]>();

export type SupportInput = {
  name: string;
  email: string;
  topic: string;
  message: string;
  trap?: string;
};

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function topicLabel(id: string) {
  return SUPPORT_TOPICS.find((item) => item.id === id)?.label ?? "Otra cosa";
}

function allow(key: string, max: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < 60 * 60 * 1000);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

async function nextTicket() {
  const ref = adminDb().collection(COLLECTIONS.counters).doc("supportTickets");
  const seq = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = Number(snap.data()?.seq ?? 1000) + 1;
    tx.set(ref, { seq: next, updatedAt: Date.now() }, { merge: true });
    return next;
  });
  return `M-${seq}`;
}

export async function createSupportTicket(input: SupportInput, ip: string) {
  if (clean(input.trap, 80)) {
    return { ok: true as const, ticket: "M-0" };
  }

  const name = clean(input.name, 80);
  const email = clean(input.email, 120).toLowerCase();
  const message = String(input.message ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 2000);
  const topic = topicLabel(clean(input.topic, 24));

  if (!name) return { ok: false as const, error: "Dinos cómo te llamas." };
  if (!EMAIL_RE.test(email)) return { ok: false as const, error: "Revisa el correo." };
  if (message.length < 8) return { ok: false as const, error: "Cuéntanos un poco más." };
  if (!allow(ip, 8) || !allow(email, 4)) {
    return { ok: false as const, error: "Recibimos varias notas. Espera un momento." };
  }

  const ticket = await nextTicket();
  await adminDb()
    .collection(COLLECTIONS.supportTickets)
    .doc(ticket)
    .set({
      ticket,
      name,
      email,
      topic,
      message,
      ip,
      status: "open",
      createdAt: Date.now(),
    });

  try {
    await Promise.all([
      sendSupportStaffEmail({ ticket, name, email, topic, message }),
      sendSupportAckEmail({ ticket, name, email }),
    ]);
  } catch (error) {
    console.error("[soporte] email", error);
  }

  return { ok: true as const, ticket };
}
