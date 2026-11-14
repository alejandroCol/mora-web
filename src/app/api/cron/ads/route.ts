import { loadAdsConnection } from "@/server/metaAds/connection";
import { isCronKey, runAdsPilot } from "@/server/metaAds/pilot";

export const maxDuration = 120;

/**
 * Pasada programada del piloto. La llama la Function `adsPilotTick` con la llave
 * de `settings/adsCron`; sin llave válida no hace nada.
 */
export async function POST(request: Request) {
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!(await isCronKey(given))) return new Response("forbidden", { status: 403 });
  try {
    const connection = await loadAdsConnection();
    if (!connection.connected) return Response.json({ ok: true, skipped: "sin cuenta conectada" });
    const digest = new URL(request.url).searchParams.get("digest") === "1";
    const run = await runAdsPilot("schedule", { digest });
    return Response.json({ ok: true, applied: run.applied.length, suggested: run.suggested });
  } catch (error) {
    console.error("[cron ads]", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
