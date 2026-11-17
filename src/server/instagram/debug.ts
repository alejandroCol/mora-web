import type { InstagramWebhookDebug } from "@/instagram/types";
import { adminDb } from "@/lib/firebaseAdmin";

/** Último latido del webhook de Instagram, para que el panel diga si Meta está llegando. */
const EMPTY: InstagramWebhookDebug = {
  lastPostAt: 0,
  lastComments: 0,
  lastMessages: 0,
  lastError: "",
  lastRejectedAt: 0,
  lastRejectReason: "",
  registeredAt: 0,
  registeredFields: [],
};

function debugDoc() {
  return adminDb().doc("settings/instagramWebhookDebug");
}

export async function loadInstagramWebhookDebug(): Promise<InstagramWebhookDebug> {
  try {
    const snap = await debugDoc().get();
    return snap.exists ? { ...EMPTY, ...(snap.data() as Partial<InstagramWebhookDebug>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

const RECENT_MAX = 20;

export async function noteInstagramWebhookKinds(kinds: string[], messages: number) {
  await adminDb()
    .runTransaction(async (tx) => {
      const snap = await tx.get(debugDoc());
      const data = (snap.data() ?? {}) as Partial<InstagramWebhookDebug>;
      const recent = [{ at: Date.now(), kinds: kinds.slice(0, 10) }, ...(data.recent ?? [])].slice(0, RECENT_MAX);
      tx.set(debugDoc(), { recent, messagesTotal: (data.messagesTotal ?? 0) + messages }, { merge: true });
    })
    .catch((error) => console.error("[instagram webhook] debug", error));
}

export async function recordInstagramWebhook(patch: Partial<InstagramWebhookDebug>) {
  await debugDoc()
    .set(patch, { merge: true })
    .catch((error) => console.error("[instagram webhook] debug", error));
}
