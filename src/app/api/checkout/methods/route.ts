import { addiPublicConfig, boldIsConfigured, resolveBoldEnvironment } from "@/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [addi, boldEnv] = await Promise.all([addiPublicConfig(), resolveBoldEnvironment()]);
  return Response.json({
    ok: true,
    methods: {
      bold: boldIsConfigured(boldEnv),
      addi: addi.configured,
    },
    addi,
  });
}
