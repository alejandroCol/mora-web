import { parseVoteBody, saveVote, surveyResults } from "@/server/encuesta";

export const dynamic = "force-dynamic";

export async function GET() {
  const results = await surveyResults();
  return Response.json(
    { ok: true, results },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "No se pudo leer el voto." }, { status: 400 });
  }

  const vote = parseVoteBody(body);
  if (!vote) {
    return Response.json(
      { ok: false, error: "Elige hombre o mujer, y tres colores distintos." },
      { status: 400 },
    );
  }

  const saved = await saveVote(vote);
  return Response.json({ ok: true, voterId: saved.id });
}
