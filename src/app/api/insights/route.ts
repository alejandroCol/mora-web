import type { InsightTrackBody } from "@/insights/types";
import { ingestInsights } from "@/server/insights";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InsightTrackBody;
    const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
    const events = Array.isArray(body.events) ? body.events : [];
    if (!visitorId || events.length === 0) {
      return Response.json({ ok: false }, { status: 400 });
    }
    await ingestInsights({ visitorId, events });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
