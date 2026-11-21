import { ensurePricing } from "@/server/pricing";
import { publicPromos } from "@/server/promos";
import { getSalesPresentation } from "@/server/salesPolicy";

export const dynamic = "force-dynamic";

export async function GET() {
  const [sales, pricing, promos] = await Promise.all([
    getSalesPresentation(),
    ensurePricing(),
    publicPromos(),
  ]);
  return Response.json({ ok: true, sales, pricing, promos });
}
