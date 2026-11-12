import { adminDb } from "@/lib/firebaseAdmin";
import { secretFingerprint, verifyMetaSignature } from "./metaSignature";

export type WhatsAppWebhookDebug = {
  lastPostAt: number;
  lastIngestAt: number;
  lastMessageCount: number;
  lastIngested: number;
  lastFrom: string;
  lastError: string;
  lastObject: string;
  updatedAt: number;
  /** Huella del App secret con el que ya llegó un aviso bien firmado. Desde ahí la firma es obligatoria. */
  signatureProvenFor?: string;
  /** Último aviso aceptado sin firma comprobada (App secret ausente o distinto al de Meta). */
  lastUnsignedAt?: number;
  /** Último aviso rechazado por firma inválida. */
  lastRejectedAt?: number;
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

export type WebhookSignatureVerdict = "signed" | "unverified" | "rejected";

let provenFingerprint: string | null = null;
let provenLoadedAt = 0;
let lastSignatureNoteAt = 0;

async function loadProvenFingerprint() {
  if (provenFingerprint !== null && Date.now() - provenLoadedAt < 5 * 60_000) return provenFingerprint;
  const snap = await debugDoc().get();
  provenFingerprint = String(snap.get("signatureProvenFor") ?? "");
  provenLoadedAt = Date.now();
  return provenFingerprint;
}

async function noteSignature(patch: Partial<WhatsAppWebhookDebug>) {
  if (Date.now() - lastSignatureNoteAt < 60_000) return;
  lastSignatureNoteAt = Date.now();
  await debugDoc().set(patch, { merge: true }).catch(() => undefined);
}

/**
 * Firma del webhook de WhatsApp sin tumbar la bandeja que ya está en producción.
 * Mientras ningún aviso haya llegado bien firmado con el App secret guardado, se
 * acepta sin comprobar (el secreto puede faltar o estar mal copiado). En cuanto
 * uno lo demuestra, la firma pasa a ser obligatoria y lo falso se rechaza.
 */
export async function checkWhatsAppSignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): Promise<WebhookSignatureVerdict> {
  const fingerprint = appSecret ? secretFingerprint(appSecret) : "";
  if (fingerprint && verifyMetaSignature(rawBody, header, appSecret)) {
    if (provenFingerprint !== fingerprint) {
      await debugDoc().set({ signatureProvenFor: fingerprint }, { merge: true });
      provenFingerprint = fingerprint;
      provenLoadedAt = Date.now();
    }
    return "signed";
  }
  const proven = await loadProvenFingerprint().catch(() => "");
  if (fingerprint && proven === fingerprint) {
    await noteSignature({ lastRejectedAt: Date.now() });
    return "rejected";
  }
  await noteSignature({ lastUnsignedAt: Date.now() });
  return "unverified";
}
