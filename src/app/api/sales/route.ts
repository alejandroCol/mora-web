import { getSalesPresentation } from "@/server/salesPolicy";

export async function GET() {
  const sales = await getSalesPresentation();
  return Response.json({ ok: true, sales });
}
