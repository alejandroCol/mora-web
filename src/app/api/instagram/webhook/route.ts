import { loadGrowthSettings } from "@/server/growthSettings";
import { recordInstagramWebhook } from "@/server/instagram/debug";
import { ingestInstagramWebhook } from "@/server/instagram/webhook";
import { verifyMetaSignature } from "@/server/metaSignature";

export const dynamic = "force-dynamic";

/** Verificación inicial de Meta. Usa el mismo verify token que el webhook de WhatsApp (es la misma app). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const settings = await loadGrowthSettings();

  if (mode === "subscribe" && token && token === settings.whatsappVerifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

let lastRejectNoteAt = 0;

/** Deja rastro del rechazo para el panel, como mucho una vez por minuto (no escribir por cada intento ajeno). */
async function reject(status: number, why: string) {
  if (Date.now() - lastRejectNoteAt > 60_000) {
    lastRejectNoteAt = Date.now();
    await recordInstagramWebhook({ lastRejectedAt: Date.now(), lastRejectReason: why });
  }
  return new Response(why, { status });
}

/**
 * Comentarios y mensajes de Instagram. Aquí un aviso falso dispararía DMs
 * reales, así que sin firma válida de Meta no se procesa nada.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const settings = await loadGrowthSettings();
  if (!settings.whatsappAppSecret) {
    return reject(503, "Falta el App secret en Campañas: sin él no se puede comprobar que el aviso viene de Meta.");
  }
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), settings.whatsappAppSecret)) {
    return reject(401, "Firma inválida: el App secret guardado en Campañas no coincide con el de la app de Meta.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  // Siempre 200 tras una firma válida: si algo falla adentro queda en el panel,
  // y un reintento de Meta no duplicaría nada (cada comentario y mensaje se guarda por su id).
  const result = await ingestInstagramWebhook(payload, settings).catch((error: unknown) => ({
    comments: 0,
    messages: 0,
    errors: [error instanceof Error ? error.message : "fallo al procesar"],
  }));
  if (result.errors.length > 0) console.error("[instagram webhook]", result.errors);
  await recordInstagramWebhook({
    lastPostAt: Date.now(),
    lastComments: result.comments,
    lastMessages: result.messages,
    lastError: result.errors.join(" · ").slice(0, 500),
  });
  return Response.json({ ok: true });
}
