import { addiPublicConfig, boldIsConfigured } from "@/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const addi = addiPublicConfig();
  return Response.json({
    ok: true,
    methods: {
      bold: boldIsConfigured(),
      addi: addi.configured,
    },
    addi,
  });
}
