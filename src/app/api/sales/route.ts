import { ensurePricing } from "@/server/pricing";
import { publicPromos } from "@/server/promos";
import { getSalesPresentation } from "@/server/salesPolicy";
import { caseColorsOut } from "@/server/scarcity";

export const dynamic = "force-dynamic";

export async function GET() {
  const [sales, pricing, promos, caseOut] = await Promise.all([
    getSalesPresentation(),
    ensurePricing(),
    publicPromos(),
    caseColorsOut(),
  ]);
  return Response.json({ ok: true, sales, pricing, promos, caseOut });
}
