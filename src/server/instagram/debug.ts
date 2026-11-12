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

export async function recordInstagramWebhook(patch: Partial<InstagramWebhookDebug>) {
  await debugDoc()
    .set(patch, { merge: true })
    .catch((error) => console.error("[instagram webhook] debug", error));
}
