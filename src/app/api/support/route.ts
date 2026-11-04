import { createSupportTicket } from "@/server/support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "No se pudo leer el mensaje." }, { status: 400 });
  }

  try {
    const result = await createSupportTicket(
      {
        name: String(body.name ?? ""),
        email: String(body.email ?? ""),
        topic: String(body.topic ?? ""),
        message: String(body.message ?? ""),
        trap: String(body.company ?? ""),
      },
      clientIp(request),
    );
    if (!result.ok) {
      return Response.json(result, { status: 400 });
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[soporte]", error);
    return Response.json({ ok: false, error: "No se pudo enviar. Intenta de nuevo." }, { status: 500 });
  }
}
