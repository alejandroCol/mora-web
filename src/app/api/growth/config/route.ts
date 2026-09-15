import { loadGrowthSettings, publicGrowthConfig } from "@/server/growthSettings";

export async function GET() {
  const settings = await loadGrowthSettings();
  return Response.json({ ok: true, config: publicGrowthConfig(settings) });
}
