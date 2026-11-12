import { loadGrowthSettings } from "@/server/growthSettings";
import { checkWhatsAppSignature, recordWhatsAppWebhookPost } from "@/server/whatsappWebhookDebug";
import { ingestWhatsAppWebhook } from "@/server/whatsapp";

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

export async function POST(request: Request) {
  const raw = await request.text();
  const settings = await loadGrowthSettings();
  const verdict = await checkWhatsAppSignature(
    raw,
    request.headers.get("x-hub-signature-256"),
    settings.whatsappAppSecret,
  );
  if (verdict === "rejected") return new Response("invalid signature", { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  await recordWhatsAppWebhookPost(payload, () => ingestWhatsAppWebhook(payload)).catch((error) => {
    console.error("[whatsapp webhook]", error);
  });
  return Response.json({ ok: true });
}
