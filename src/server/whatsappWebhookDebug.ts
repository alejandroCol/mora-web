import { adminDb } from "@/lib/firebaseAdmin";

export type WhatsAppWebhookDebug = {
  lastPostAt: number;
  lastIngestAt: number;
  lastMessageCount: number;
  lastIngested: number;
  lastFrom: string;
  lastError: string;
  lastObject: string;
  updatedAt: number;
};

const EMPTY: WhatsAppWebhookDebug = {
  lastPostAt: 0,
  lastIngestAt: 0,
  lastMessageCount: 0,
  lastIngested: 0,
  lastFrom: "",
  lastError: "",
  lastObject: "",
  updatedAt: 0,
};

function debugDoc() {
  return adminDb().doc("settings/whatsappWebhookDebug");
}

function countInboundMessages(payload: unknown) {
  const root = payload as {
    object?: string;
    entry?: { changes?: { value?: { messages?: unknown[] } }[] }[];
  };
  let n = 0;
  let from = "";
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const msgs = change.value?.messages ?? [];
      n += msgs.length;
      const first = msgs[0] as { from?: string } | undefined;
      if (first?.from) from = first.from;
    }
  }
  return { count: n, from, object: root.object ?? "" };
}

export async function loadWhatsAppWebhookDebug(): Promise<WhatsAppWebhookDebug> {
  try {
    const snap = await debugDoc().get();
    if (!snap.exists) return EMPTY;
    return { ...EMPTY, ...(snap.data() as WhatsAppWebhookDebug) };
  } catch {
    return EMPTY;
  }
}

export async function recordWhatsAppWebhookPost(
  payload: unknown,
  ingest: () => Promise<unknown>,
) {
  const meta = countInboundMessages(payload);
  const base = {
    lastPostAt: Date.now(),
    lastMessageCount: meta.count,
    lastFrom: meta.from,
    lastObject: meta.object,
    updatedAt: Date.now(),
  };
  try {
    const seen = await ingest();
    const ingested = Array.isArray(seen) ? seen.length : meta.count;
    await debugDoc().set(
      {
        ...base,
        lastIngestAt: Date.now(),
        lastIngested: ingested,
        lastError: "",
      },
      { merge: true },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "ingest failed";
    await debugDoc().set(
      {
        ...base,
        lastError: message,
      },
      { merge: true },
    );
    throw error;
  }
}
