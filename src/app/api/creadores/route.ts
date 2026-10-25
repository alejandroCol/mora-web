import { buffersFromFiles, fieldsFromForm, submitCreatorApplication } from "@/server/creadores";
import type { FieldIssue } from "@/lib/creatorApplication";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}

function allow(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < 60 * 60 * 1000);
  if (recent.length >= 30) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

function issueResponse(issue: FieldIssue, status = 400) {
  return Response.json({ ok: false, field: issue.field, error: issue.text }, { status });
}

export async function POST(request: Request) {
  if (!allow(clientIp(request))) {
    return Response.json(
      { ok: false, error: "Recibimos varios intentos. Espera un momento y vuelve a enviar." },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "No se pudo leer el registro." }, { status: 400 });
  }

  if (String(form.get("mora_hp") ?? "").trim()) {
    return Response.json({ ok: true, emailSent: true, already: false });
  }

  const parsed = fieldsFromForm(form);
  if (!parsed.ok) return issueResponse(parsed.issue);

  const files = form
    .getAll("shots")
    .filter((item): item is File => item instanceof File && item.size > 0);
  const shots = await buffersFromFiles(files);
  if (!Array.isArray(shots)) return issueResponse(shots);

  try {
    const saved = await submitCreatorApplication(parsed.value, shots);
    return Response.json(saved, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[creadores]", error);
    return Response.json(
      { ok: false, error: "No se pudo guardar. Intenta de nuevo en un momento." },
      { status: 500 },
    );
  }
}
