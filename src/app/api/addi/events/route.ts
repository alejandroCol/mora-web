import { addiWebhookHeaders, handleAddiEvent } from "@/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: addiWebhookHeaders() });
}

export async function GET() {
  return Response.json({ ok: true, service: "addi-webhook" }, { headers: addiWebhookHeaders() });
}

export async function POST(request: Request) {
  return handleAddiEvent(request);
}
