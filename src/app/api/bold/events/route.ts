import { handleBoldEvent } from "@/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, service: "bold-webhook" });
}

export async function POST(request: Request) {
  return handleBoldEvent(request);
}
