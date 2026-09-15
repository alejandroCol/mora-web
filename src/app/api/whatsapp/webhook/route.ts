import { loadGrowthSettings } from "@/server/growthSettings";
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
  const payload = await request.json();
  await ingestWhatsAppWebhook(payload).catch((error) => {
    console.error("[whatsapp webhook]", error);
  });
  return Response.json({ ok: true });
}
