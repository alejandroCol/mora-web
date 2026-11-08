import { ensurePricing } from "@/server/pricing";
import { getSalesPresentation } from "@/server/salesPolicy";

export const dynamic = "force-dynamic";

export async function GET() {
  const [sales, pricing] = await Promise.all([getSalesPresentation(), ensurePricing()]);
  return Response.json({ ok: true, sales, pricing });
}
